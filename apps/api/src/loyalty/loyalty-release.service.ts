import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LoyaltyLedgerService } from './loyalty-ledger.service';

@Injectable()
export class LoyaltyReleaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LoyaltyLedgerService,
  ) {}

  async releaseDueForUser(userId: string) {
    const due = await this.prisma.$queryRaw<
      Array<{
        orderId: string | null;
        points: number;
        idempotencyKey: string;
      }>
    >`
      SELECT lt."orderId", lt."points", lt."idempotencyKey"
      FROM "LoyaltyTransaction" lt
      JOIN "LoyaltyAccount" la ON la."id" = lt."accountId"
      WHERE la."userId" = ${userId}::uuid
        AND lt."type" = 'EARN_PENDING'::"LoyaltyTransactionType"
        AND lt."status" = 'PENDING'::"LoyaltyTransactionStatus"
        AND lt."availableAt" <= CURRENT_TIMESTAMP
        AND NOT EXISTS (
          SELECT 1 FROM "LoyaltyTransaction" released
          WHERE released."idempotencyKey" = lt."idempotencyKey" || ':released'
        )
        AND NOT EXISTS (
          SELECT 1 FROM "LoyaltyTransaction" reversed
          WHERE reversed."idempotencyKey" = 'order:' || lt."orderId"::text || ':loyalty:earn-reversal'
        )
      ORDER BY lt."availableAt" ASC
      LIMIT 100
    `;
    for (const transaction of due) {
      await this.ledger.releasePending(
        userId,
        transaction.points,
        `${transaction.idempotencyKey}:released`,
        transaction.orderId ?? undefined,
      );
    }
    return { released: due.length };
  }
}
