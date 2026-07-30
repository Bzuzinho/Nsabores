import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LoyaltyLedgerService } from './loyalty-ledger.service';

type RuleRow = {
  id: string;
  pointsPerEuro: number;
  clubMultiplierBasisPoints: number;
  minimumOrderCents: number | null;
  maximumPointsPerOrder: number | null;
  pendingDays: number;
};

type OrderRow = {
  id: string;
  userId: string | null;
  totalCents: number;
  salesChannel: 'B2C' | 'B2B';
  loyaltyAmountCents: number;
  giftCardAmountCents: number;
  hasClub: boolean;
};

@Injectable()
export class LoyaltyEarningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LoyaltyLedgerService,
  ) {}

  async accrueForPaidOrder(orderId: string) {
    const orders = await this.prisma.$queryRaw<OrderRow[]>`
      SELECT o."id", o."userId", o."totalCents", o."salesChannel",
             COALESCE(ola."amountCents", 0) AS "loyaltyAmountCents",
             COALESCE(oga."amountCents", 0) AS "giftCardAmountCents",
             EXISTS (
               SELECT 1 FROM "ClubSubscription" cs
               WHERE cs."userId" = o."userId"
                 AND cs."status" IN ('TRIALING','ACTIVE','CANCEL_AT_PERIOD_END')
                 AND cs."currentPeriodEnd" > CURRENT_TIMESTAMP
             ) AS "hasClub"
      FROM "Order" o
      LEFT JOIN "OrderLoyaltyApplication" ola ON ola."orderId" = o."id"
      LEFT JOIN "OrderGiftCardApplication" oga ON oga."orderId" = o."id"
      WHERE o."id" = ${orderId}::uuid LIMIT 1
    `;
    const order = orders[0];
    if (!order?.userId) return null;

    const rules = await this.prisma.$queryRaw<RuleRow[]>`
      SELECT "id", "pointsPerEuro", "clubMultiplierBasisPoints", "minimumOrderCents",
             "maximumPointsPerOrder", "pendingDays"
      FROM "LoyaltyRule"
      WHERE "isActive" = true
        AND ("channel" IS NULL OR "channel" = ${order.salesChannel}::"SalesChannel")
        AND ("validFrom" IS NULL OR "validFrom" <= CURRENT_TIMESTAMP)
        AND ("validUntil" IS NULL OR "validUntil" >= CURRENT_TIMESTAMP)
      ORDER BY "createdAt" ASC LIMIT 1
    `;
    const rule = rules[0];
    if (!rule || rule.pointsPerEuro <= 0) return null;

    // Gift cards are money; redeemed loyalty points are not eligible spend.
    const eligibleCents = order.totalCents + order.giftCardAmountCents;
    if (rule.minimumOrderCents !== null && eligibleCents < rule.minimumOrderCents) return null;

    let points = Math.floor(eligibleCents / 100) * rule.pointsPerEuro;
    if (order.hasClub) {
      points = Math.floor((points * rule.clubMultiplierBasisPoints) / 10_000);
    }
    if (rule.maximumPointsPerOrder !== null) {
      points = Math.min(points, rule.maximumPointsPerOrder);
    }
    if (points <= 0) return null;

    const availableAt = new Date(Date.now() + rule.pendingDays * 86_400_000);
    return this.ledger.earnPending(
      order.userId,
      points,
      `order:${order.id}:loyalty:earn`,
      availableAt,
      order.id,
    );
  }
}
