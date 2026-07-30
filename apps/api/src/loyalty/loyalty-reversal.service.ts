import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

const serializable = { isolationLevel: 'Serializable' as const };

@Injectable()
export class LoyaltyReversalService {
  constructor(private readonly prisma: PrismaService) {}

  refundPoints(userId: string, points: number, idempotencyKey: string, orderId: string) {
    if (points <= 0) throw new ConflictException('Os pontos a devolver têm de ser positivos.');
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM "LoyaltyTransaction" WHERE "idempotencyKey" = ${idempotencyKey} LIMIT 1
      `;
      if (duplicate[0]) return duplicate[0];
      const accounts = await tx.$queryRaw<Array<{
        id: string; availablePoints: number; pendingPoints: number; reservedPoints: number;
      }>>`
        SELECT "id", "availablePoints", "pendingPoints", "reservedPoints"
        FROM "LoyaltyAccount" WHERE "userId" = ${userId}::uuid FOR UPDATE
      `;
      const account = accounts[0];
      if (!account) throw new NotFoundException('Conta de fidelização não encontrada.');
      const available = account.availablePoints + points;
      await tx.$executeRaw`
        UPDATE "LoyaltyAccount" SET "availablePoints" = ${available},
          "lifetimeRedeemedPoints" = GREATEST(0, "lifetimeRedeemedPoints" - ${points}),
          "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${account.id}::uuid
      `;
      const id = randomUUID();
      await tx.$executeRaw`
        INSERT INTO "LoyaltyTransaction" (
          "id", "accountId", "orderId", "type", "status", "points", "availableBalanceAfter",
          "pendingBalanceAfter", "reservedBalanceAfter", "idempotencyKey", "note", "createdAt"
        ) VALUES (
          ${id}::uuid, ${account.id}::uuid, ${orderId}::uuid, 'REVERSED'::"LoyaltyTransactionType",
          'COMPLETED'::"LoyaltyTransactionStatus", ${points}, ${available}, ${account.pendingPoints},
          ${account.reservedPoints}, ${idempotencyKey}, 'Pontos devolvidos após reembolso.', CURRENT_TIMESTAMP
        )
      `;
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM "LoyaltyTransaction" WHERE "id" = ${id}::uuid
      `;
      return rows[0];
    }, serializable);
  }

  refundGiftCard(giftCardId: string, amountCents: number, idempotencyKey: string, orderId: string) {
    if (amountCents <= 0) throw new ConflictException('O montante a devolver tem de ser positivo.');
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM "GiftCardTransaction" WHERE "idempotencyKey" = ${idempotencyKey} LIMIT 1
      `;
      if (duplicate[0]) return duplicate[0];
      const cards = await tx.$queryRaw<Array<{
        id: string; initialAmountCents: number; balanceCents: number; reservedCents: number;
      }>>`
        SELECT "id", "initialAmountCents", "balanceCents", "reservedCents"
        FROM "GiftCard" WHERE "id" = ${giftCardId}::uuid FOR UPDATE
      `;
      const card = cards[0];
      if (!card) throw new NotFoundException('Vale-oferta não encontrado.');
      const balance = card.balanceCents + amountCents;
      if (balance + card.reservedCents > card.initialAmountCents) {
        throw new ConflictException('A devolução excede o valor emitido do vale.');
      }
      await tx.$executeRaw`
        UPDATE "GiftCard" SET "balanceCents" = ${balance}, "status" = 'ACTIVE'::"GiftCardStatus",
          "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${giftCardId}::uuid
      `;
      const id = randomUUID();
      await tx.$executeRaw`
        INSERT INTO "GiftCardTransaction" (
          "id", "giftCardId", "orderId", "type", "status", "amountCents",
          "balanceAfterCents", "reservedAfterCents", "idempotencyKey", "note", "createdAt"
        ) VALUES (
          ${id}::uuid, ${giftCardId}::uuid, ${orderId}::uuid, 'REFUND'::"GiftCardTransactionType",
          'COMPLETED'::"GiftCardTransactionStatus", ${amountCents}, ${balance}, ${card.reservedCents},
          ${idempotencyKey}, 'Saldo devolvido ao vale após reembolso.', CURRENT_TIMESTAMP
        )
      `;
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM "GiftCardTransaction" WHERE "id" = ${id}::uuid
      `;
      return rows[0];
    }, serializable);
  }
}
