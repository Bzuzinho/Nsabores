import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { LoyaltyService } from '../src/loyalty/loyalty.service';
import { PrismaService } from '../src/prisma.service';

async function main() {
  const prisma = new PrismaService();
  const loyalty = new LoyaltyService(prisma);
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const user = await prisma.user.create({
    data: {
      email: `loyalty-smoke-${suffix}@example.invalid`,
      passwordHash: 'not-used',
      firstName: 'Loyalty',
      lastName: 'Smoke',
      emailVerifiedAt: new Date(),
    },
  });
  let giftCardId: string | undefined;
  let ruleId: string | undefined;

  try {
    const first = await loyalty.adjust(user.id, {
      points: 250,
      note: 'Crédito inicial do smoke.',
      idempotencyKey: `loyalty:${suffix}:credit`,
    });
    const duplicate = await loyalty.adjust(user.id, {
      points: 250,
      note: 'Crédito inicial do smoke.',
      idempotencyKey: `loyalty:${suffix}:credit`,
    });
    assert.equal(first.id, duplicate.id);

    await loyalty.adjust(user.id, {
      points: -75,
      note: 'Utilização do smoke.',
      idempotencyKey: `loyalty:${suffix}:debit`,
    });
    const account = (await loyalty.account(user.id)) as Record<string, unknown>;
    assert.equal(account.availablePoints, 175);
    assert.equal(account.lifetimeEarnedPoints, 250);
    assert.equal(account.lifetimeRedeemedPoints, 75);
    assert.equal((account.transactions as unknown[]).length, 2);

    const rule = (await loyalty.createRule({
      name: `Regra ${suffix}`,
      code: `RULE-${suffix}`,
      isActive: true,
      channel: 'B2C',
      pointsPerEuro: 1,
      clubMultiplierBasisPoints: 15000,
      minimumOrderCents: 1000,
      maximumPointsPerOrder: 500,
      pendingDays: 14,
      configuration: {},
    })) as Record<string, unknown>;
    ruleId = String(rule.id);

    const issued = (await loyalty.issueGiftCard(
      {
        initialAmountCents: 5000,
        recipientEmail: `recipient-${suffix}@example.invalid`,
        recipientName: 'Destinatário Smoke',
        message: 'Teste de vale.',
        idempotencyKey: `gift-card:${suffix}:issue`,
      },
      user.id,
    )) as Record<string, unknown>;
    giftCardId = String(issued.id);
    const code = String(issued.code);
    assert.ok(code.startsWith('NS-'));
    assert.equal(issued.balanceCents, 5000);

    const found = (await loyalty.lookupGiftCard(code)) as Record<string, unknown>;
    assert.equal(found.id, giftCardId);
    assert.equal(found.balanceCents, 5000);

    await loyalty.blockGiftCard(giftCardId, { reason: 'Smoke test.' });
    const blocked = (await loyalty.lookupGiftCard(code)) as Record<string, unknown>;
    assert.equal(blocked.status, 'BLOCKED');

    console.log('Loyalty and gift-card smoke passed.');
  } finally {
    if (giftCardId) {
      await prisma.$executeRaw`DELETE FROM "GiftCard" WHERE "id" = ${giftCardId}::uuid`;
    }
    if (ruleId) {
      await prisma.$executeRaw`DELETE FROM "LoyaltyRule" WHERE "id" = ${ruleId}::uuid`;
    }
    await prisma.$executeRaw`DELETE FROM "LoyaltyAccount" WHERE "userId" = ${user.id}::uuid`;
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
