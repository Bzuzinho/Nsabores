import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LoyaltyLedgerService } from './loyalty-ledger.service';

const serializable = { isolationLevel: 'Serializable' as const };

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

    const eligibleCents = order.totalCents + order.giftCardAmountCents;
    if (
      rule.minimumOrderCents !== null &&
      eligibleCents < rule.minimumOrderCents
    )
      return null;

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

  async reverseForRefundedOrder(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "LoyaltyTransaction"
        WHERE "idempotencyKey" = ${`order:${orderId}:loyalty:earn-reversal`}
        LIMIT 1
      `;
      if (duplicate[0]) return duplicate[0];

      const earnings = await tx.$queryRaw<
        Array<{ accountId: string; points: number }>
      >`
        SELECT "accountId", "points"
        FROM "LoyaltyTransaction"
        WHERE "idempotencyKey" = ${`order:${orderId}:loyalty:earn`}
          AND "type" = 'EARN_PENDING'::"LoyaltyTransactionType"
        LIMIT 1
      `;
      const earning = earnings[0];
      if (!earning) return null;

      const accounts = await tx.$queryRaw<
        Array<{
          availablePoints: number;
          pendingPoints: number;
          reservedPoints: number;
          lifetimeEarnedPoints: number;
        }>
      >`
        SELECT "availablePoints", "pendingPoints", "reservedPoints", "lifetimeEarnedPoints"
        FROM "LoyaltyAccount" WHERE "id" = ${earning.accountId}::uuid FOR UPDATE
      `;
      const account = accounts[0];
      if (!account) return null;

      const pendingDeduction = Math.min(account.pendingPoints, earning.points);
      const remaining = earning.points - pendingDeduction;
      if (account.availablePoints < remaining) {
        throw new ConflictException(
          'Não é possível reverter os pontos ganhos: o saldo já foi utilizado.',
        );
      }
      const pending = account.pendingPoints - pendingDeduction;
      const available = account.availablePoints - remaining;
      const lifetime = Math.max(0, account.lifetimeEarnedPoints - earning.points);

      await tx.$executeRaw`
        UPDATE "LoyaltyAccount"
        SET "pendingPoints" = ${pending}, "availablePoints" = ${available},
            "lifetimeEarnedPoints" = ${lifetime}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${earning.accountId}::uuid
      `;
      const id = randomUUID();
      await tx.$executeRaw`
        INSERT INTO "LoyaltyTransaction" (
          "id", "accountId", "orderId", "type", "status", "points",
          "availableBalanceAfter", "pendingBalanceAfter", "reservedBalanceAfter",
          "idempotencyKey", "note", "metadata", "createdAt"
        ) VALUES (
          ${id}::uuid, ${earning.accountId}::uuid, ${orderId}::uuid,
          'REVERSED'::"LoyaltyTransactionType", 'COMPLETED'::"LoyaltyTransactionStatus",
          ${-earning.points}, ${available}, ${pending}, ${account.reservedPoints},
          ${`order:${orderId}:loyalty:earn-reversal`},
          'Pontos ganhos revertidos após reembolso da encomenda.',
          ${JSON.stringify({ source: 'ORDER_REFUND' })}::jsonb, CURRENT_TIMESTAMP
        )
      `;
      return { id };
    }, serializable);
  }
}
