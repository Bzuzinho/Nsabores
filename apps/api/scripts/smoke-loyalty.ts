import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { LoyaltyLedgerService } from '../src/loyalty/loyalty-ledger.service';
import { LoyaltyService } from '../src/loyalty/loyalty.service';
import { PrismaService } from '../src/prisma.service';

async function main() {
  const prisma = new PrismaService();
  const loyalty = new LoyaltyService(prisma);
  const ledger = new LoyaltyLedgerService(prisma);
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

    await ledger.reservePoints(user.id, 80, `loyalty:${suffix}:reserve`);
    await ledger.releaseReservedPoints(
      user.id,
      30,
      `loyalty:${suffix}:release`,
    );
    await ledger.settleReservedPoints(user.id, 50, `loyalty:${suffix}:settle`);
    await ledger.earnPending(
      user.id,
      120,
      `loyalty:${suffix}:pending`,
      new Date(Date.now() - 1_000),
    );
    await ledger.releasePending(
      user.id,
      120,
      `loyalty:${suffix}:pending-release`,
    );

    const account = (await loyalty.account(user.id)) as Record<string, unknown>;
    assert.equal(account.availablePoints, 320);
    assert.equal(account.pendingPoints, 0);
    assert.equal(account.reservedPoints, 0);
    assert.equal(account.lifetimeEarnedPoints, 370);
    assert.equal(account.lifetimeRedeemedPoints, 50);

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

    await ledger.reserveGiftCard(
      giftCardId,
      2000,
      `gift-card:${suffix}:reserve`,
    );
    await ledger.releaseGiftCard(
      giftCardId,
      500,
      `gift-card:${suffix}:release`,
    );
    await ledger.settleGiftCard(giftCardId, 1500, `gift-card:${suffix}:settle`);

    const found = (await loyalty.lookupGiftCard(code)) as Record<
      string,
      unknown
    >;
    assert.equal(found.balanceCents, 3500);
    assert.equal(found.reservedCents, 0);

    await loyalty.blockGiftCard(giftCardId, { reason: 'Smoke test.' });
    const blocked = (await loyalty.lookupGiftCard(code)) as Record<
      string,
      unknown
    >;
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
