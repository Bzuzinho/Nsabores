import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import {
  ClubBillingInterval,
  ClubChargeStatus,
  ClubPlanStatus,
  ClubSubscriptionStatus,
  GiftCardPurchaseStatus,
} from '@prisma/client';
import { PrismaService } from './prisma.service';
import { SourceFiscalService } from './fiscal/source-fiscal.service';

async function main() {
  const prisma = new PrismaService();
  const fiscal = new SourceFiscalService(prisma);
  const suffix = randomUUID();
  let userId: string | undefined;
  let purchaseId: string | undefined;
  let planId: string | undefined;
  let subscriptionId: string | undefined;
  let chargeId: string | undefined;

  try {
    const user = await prisma.user.create({
      data: {
        email: `fiscal-sources-${suffix}@example.test`,
        passwordHash: 'not-used-by-smoke',
        firstName: 'Cliente',
        lastName: 'Fiscal Sources',
        phone: '910000001',
        role: 'CUSTOMER',
        isActive: true,
      },
    });
    userId = user.id;

    const purchase = await prisma.giftCardPurchase.create({
      data: {
        purchaserUserId: user.id,
        purchaserEmail: user.email,
        recipientEmail: `recipient-${suffix}@example.test`,
        recipientName: 'Destinatário Teste',
        amountCents: 2500,
        currency: 'EUR',
        status: GiftCardPurchaseStatus.PENDING_PAYMENT,
        idempotencyKey: `fiscal-source-gift:${suffix}`,
      },
    });
    purchaseId = purchase.id;

    await assert.rejects(
      () => fiscal.issueGiftCardPurchase(purchase.id),
      (error: unknown) => error instanceof ConflictException,
    );

    await prisma.giftCardPurchase.update({
      where: { id: purchase.id },
      data: { status: GiftCardPurchaseStatus.PAID, paidAt: new Date() },
    });

    const giftDocument = await fiscal.issueGiftCardPurchase(purchase.id);
    const duplicateGiftDocument = await fiscal.issueGiftCardPurchase(purchase.id);
    assert.equal(giftDocument.id, duplicateGiftDocument.id);
    assert.equal(giftDocument.sourceType, 'GIFT_CARD_PURCHASE');
    assert.equal(giftDocument.customerUserId, user.id);
    assert.equal(giftDocument.totalCents, 2500);
    assert.equal(giftDocument.lines.length, 1);

    const plan = await prisma.clubPlan.create({
      data: {
        name: 'Plano Fiscal Smoke',
        code: `FISCAL-SMOKE-${suffix}`,
        description: 'Plano temporário para teste fiscal.',
        status: ClubPlanStatus.ACTIVE,
        priceCents: 1900,
        currency: 'EUR',
        billingInterval: ClubBillingInterval.MONTHLY,
        benefits: {},
        isPublic: false,
      },
    });
    planId = plan.id;

    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

    const subscription = await prisma.clubSubscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: ClubSubscriptionStatus.PENDING_ACTIVATION,
        provider: 'manual',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        priceCentsSnapshot: plan.priceCents,
        currencySnapshot: plan.currency,
        billingIntervalSnapshot: plan.billingInterval,
        planSnapshot: {
          name: plan.name,
          code: plan.code,
        },
      },
    });
    subscriptionId = subscription.id;

    const charge = await prisma.clubSubscriptionCharge.create({
      data: {
        subscriptionId: subscription.id,
        periodStart,
        periodEnd,
        amountCents: plan.priceCents,
        currency: plan.currency,
        status: ClubChargeStatus.PENDING,
        provider: 'manual',
        idempotencyKey: `fiscal-source-club:${suffix}`,
      },
    });
    chargeId = charge.id;

    await assert.rejects(
      () => fiscal.issueClubCharge(charge.id),
      (error: unknown) => error instanceof ConflictException,
    );

    await prisma.clubSubscriptionCharge.update({
      where: { id: charge.id },
      data: { status: ClubChargeStatus.PAID, paidAt: new Date() },
    });

    const clubDocument = await fiscal.issueClubCharge(charge.id);
    const duplicateClubDocument = await fiscal.issueClubCharge(charge.id);
    assert.equal(clubDocument.id, duplicateClubDocument.id);
    assert.equal(clubDocument.sourceType, 'CLUB_CHARGE');
    assert.equal(clubDocument.customerUserId, user.id);
    assert.equal(clubDocument.totalCents, 1900);
    assert.equal(clubDocument.lines.length, 1);
    assert.notEqual(clubDocument.number, giftDocument.number);

    const count = await prisma.fiscalDocument.count({
      where: {
        OR: [
          { sourceType: 'GIFT_CARD_PURCHASE', sourceId: purchase.id },
          { sourceType: 'CLUB_CHARGE', sourceId: charge.id },
        ],
      },
    });
    assert.equal(count, 2);

    console.log('Gift card and Club fiscal source smoke passed.');
  } finally {
    await prisma.fiscalDocument.deleteMany({
      where: {
        OR: [
          ...(purchaseId
            ? [{ sourceType: 'GIFT_CARD_PURCHASE' as const, sourceId: purchaseId }]
            : []),
          ...(chargeId
            ? [{ sourceType: 'CLUB_CHARGE' as const, sourceId: chargeId }]
            : []),
        ],
      },
    });
    if (chargeId) {
      await prisma.clubSubscriptionCharge.deleteMany({ where: { id: chargeId } });
    }
    if (subscriptionId) {
      await prisma.clubSubscription.deleteMany({ where: { id: subscriptionId } });
    }
    if (planId) {
      await prisma.clubPlan.deleteMany({ where: { id: planId } });
    }
    if (purchaseId) {
      await prisma.giftCardPurchase.deleteMany({ where: { id: purchaseId } });
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
  }
}

void main();
