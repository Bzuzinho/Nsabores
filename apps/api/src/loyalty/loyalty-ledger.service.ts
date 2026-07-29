import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

const serializable = { isolationLevel: 'Serializable' as const };

type LoyaltyAccountRow = {
  id: string;
  availablePoints: number;
  pendingPoints: number;
  reservedPoints: number;
};

type GiftCardRow = {
  id: string;
  status: string;
  balanceCents: number;
  reservedCents: number;
  expiresAt: Date | null;
};

@Injectable()
export class LoyaltyLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  earnPending(userId: string, points: number, idempotencyKey: string, availableAt: Date, orderId?: string) {
    if (points <= 0) throw new ConflictException('Os pontos a acumular têm de ser positivos.');
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await this.loyaltyDuplicate(tx, idempotencyKey);
      if (duplicate) return duplicate;
      const account = await this.lockAccount(tx, userId);
      const pending = account.pendingPoints + points;
      await tx.$executeRaw`
        UPDATE "LoyaltyAccount" SET "pendingPoints" = ${pending},
          "lifetimeEarnedPoints" = "lifetimeEarnedPoints" + ${points}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${account.id}::uuid
      `;
      return this.insertLoyalty(tx, account.id, orderId, 'EARN_PENDING', 'PENDING', points,
        account.availablePoints, pending, account.reservedPoints, idempotencyKey, availableAt);
    }, serializable);
  }

  releasePending(userId: string, points: number, idempotencyKey: string, orderId?: string) {
    if (points <= 0) throw new ConflictException('Os pontos a libertar têm de ser positivos.');
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await this.loyaltyDuplicate(tx, idempotencyKey);
      if (duplicate) return duplicate;
      const account = await this.lockAccount(tx, userId);
      if (account.pendingPoints < points) throw new ConflictException('Saldo pendente insuficiente.');
      const pending = account.pendingPoints - points;
      const available = account.availablePoints + points;
      await tx.$executeRaw`
        UPDATE "LoyaltyAccount" SET "pendingPoints" = ${pending}, "availablePoints" = ${available},
          "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${account.id}::uuid
      `;
      return this.insertLoyalty(tx, account.id, orderId, 'EARN_RELEASED', 'AVAILABLE', points,
        available, pending, account.reservedPoints, idempotencyKey);
    }, serializable);
  }

  reservePoints(userId: string, points: number, idempotencyKey: string, orderId?: string) {
    if (points <= 0) throw new ConflictException('A reserva de pontos tem de ser positiva.');
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await this.loyaltyDuplicate(tx, idempotencyKey);
      if (duplicate) return duplicate;
      const account = await this.lockAccount(tx, userId);
      if (account.availablePoints < points) throw new ConflictException('Saldo de pontos insuficiente.');
      const available = account.availablePoints - points;
      const reserved = account.reservedPoints + points;
      await tx.$executeRaw`
        UPDATE "LoyaltyAccount" SET "availablePoints" = ${available}, "reservedPoints" = ${reserved},
          "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${account.id}::uuid
      `;
      return this.insertLoyalty(tx, account.id, orderId, 'REDEEM_RESERVED', 'RESERVED', -points,
        available, account.pendingPoints, reserved, idempotencyKey);
    }, serializable);
  }

  settleReservedPoints(userId: string, points: number, idempotencyKey: string, orderId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await this.loyaltyDuplicate(tx, idempotencyKey);
      if (duplicate) return duplicate;
      const account = await this.lockAccount(tx, userId);
      if (points <= 0 || account.reservedPoints < points) throw new ConflictException('Reserva de pontos insuficiente.');
      const reserved = account.reservedPoints - points;
      await tx.$executeRaw`
        UPDATE "LoyaltyAccount" SET "reservedPoints" = ${reserved},
          "lifetimeRedeemedPoints" = "lifetimeRedeemedPoints" + ${points}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${account.id}::uuid
      `;
      return this.insertLoyalty(tx, account.id, orderId, 'REDEEMED', 'COMPLETED', -points,
        account.availablePoints, account.pendingPoints, reserved, idempotencyKey);
    }, serializable);
  }

  releaseReservedPoints(userId: string, points: number, idempotencyKey: string, orderId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await this.loyaltyDuplicate(tx, idempotencyKey);
      if (duplicate) return duplicate;
      const account = await this.lockAccount(tx, userId);
      if (points <= 0 || account.reservedPoints < points) throw new ConflictException('Reserva de pontos insuficiente.');
      const reserved = account.reservedPoints - points;
      const available = account.availablePoints + points;
      await tx.$executeRaw`
        UPDATE "LoyaltyAccount" SET "reservedPoints" = ${reserved}, "availablePoints" = ${available},
          "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${account.id}::uuid
      `;
      return this.insertLoyalty(tx, account.id, orderId, 'REDEEM_RELEASED', 'CANCELLED', points,
        available, account.pendingPoints, reserved, idempotencyKey);
    }, serializable);
  }

  reserveGiftCard(giftCardId: string, amountCents: number, idempotencyKey: string, orderId?: string) {
    return this.giftCardMove(giftCardId, amountCents, idempotencyKey, 'RESERVE', orderId);
  }

  settleGiftCard(giftCardId: string, amountCents: number, idempotencyKey: string, orderId?: string) {
    return this.giftCardMove(giftCardId, amountCents, idempotencyKey, 'REDEEM', orderId);
  }

  releaseGiftCard(giftCardId: string, amountCents: number, idempotencyKey: string, orderId?: string) {
    return this.giftCardMove(giftCardId, amountCents, idempotencyKey, 'RELEASE', orderId);
  }

  private giftCardMove(
    giftCardId: string,
    amountCents: number,
    idempotencyKey: string,
    type: 'RESERVE' | 'REDEEM' | 'RELEASE',
    orderId?: string,
  ) {
    if (amountCents <= 0) throw new ConflictException('O montante tem de ser positivo.');
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM "GiftCardTransaction" WHERE "idempotencyKey" = ${idempotencyKey} LIMIT 1
      `;
      if (duplicate[0]) return duplicate[0];
      const rows = await tx.$queryRaw<GiftCardRow[]>`
        SELECT "id", "status"::text AS "status", "balanceCents", "reservedCents", "expiresAt"
        FROM "GiftCard" WHERE "id" = ${giftCardId}::uuid FOR UPDATE
      `;
      const card = rows[0];
      if (!card) throw new NotFoundException('Vale-oferta não encontrado.');
      if (card.status !== 'ACTIVE') throw new ConflictException('O vale-oferta não está ativo.');
      if (card.expiresAt && card.expiresAt <= new Date()) throw new ConflictException('O vale-oferta expirou.');

      let balance = card.balanceCents;
      let reserved = card.reservedCents;
      if (type === 'RESERVE') {
        if (balance < amountCents) throw new ConflictException('Saldo do vale insuficiente.');
        balance -= amountCents;
        reserved += amountCents;
      } else if (type === 'REDEEM') {
        if (reserved < amountCents) throw new ConflictException('Reserva do vale insuficiente.');
        reserved -= amountCents;
      } else {
        if (reserved < amountCents) throw new ConflictException('Reserva do vale insuficiente.');
        reserved -= amountCents;
        balance += amountCents;
      }
      const status = balance === 0 && reserved === 0 ? 'DEPLETED' : 'ACTIVE';
      await tx.$executeRaw`
        UPDATE "GiftCard" SET "balanceCents" = ${balance}, "reservedCents" = ${reserved},
          "status" = ${status}::"GiftCardStatus", "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${giftCardId}::uuid
      `;
      const signedAmount = type === 'RELEASE' ? amountCents : -amountCents;
      const transactionStatus = type === 'RESERVE' ? 'PENDING' : 'COMPLETED';
      const id = randomUUID();
      await tx.$executeRaw`
        INSERT INTO "GiftCardTransaction" (
          "id", "giftCardId", "orderId", "type", "status", "amountCents",
          "balanceAfterCents", "reservedAfterCents", "idempotencyKey", "createdAt"
        ) VALUES (
          ${id}::uuid, ${giftCardId}::uuid, ${orderId ?? null}::uuid, ${type}::"GiftCardTransactionType",
          ${transactionStatus}::"GiftCardTransactionStatus", ${signedAmount}, ${balance}, ${reserved},
          ${idempotencyKey}, CURRENT_TIMESTAMP
        )
      `;
      const result = await tx.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM "GiftCardTransaction" WHERE "id" = ${id}::uuid
      `;
      return result[0];
    }, serializable);
  }

  private async lockAccount(tx: Prisma.TransactionClient, userId: string): Promise<LoyaltyAccountRow> {
    await tx.$executeRaw`
      INSERT INTO "LoyaltyAccount" ("id", "userId", "createdAt", "updatedAt")
      VALUES (${randomUUID()}::uuid, ${userId}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("userId") DO NOTHING
    `;
    const rows = await tx.$queryRaw<LoyaltyAccountRow[]>`
      SELECT "id", "availablePoints", "pendingPoints", "reservedPoints"
      FROM "LoyaltyAccount" WHERE "userId" = ${userId}::uuid FOR UPDATE
    `;
    if (!rows[0]) throw new NotFoundException('Conta de fidelização não encontrada.');
    return rows[0];
  }

  private async loyaltyDuplicate(tx: Prisma.TransactionClient, idempotencyKey: string) {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM "LoyaltyTransaction" WHERE "idempotencyKey" = ${idempotencyKey} LIMIT 1
    `;
    return rows[0];
  }

  private async insertLoyalty(
    tx: Prisma.TransactionClient,
    accountId: string,
    orderId: string | undefined,
    type: string,
    status: string,
    points: number,
    available: number,
    pending: number,
    reserved: number,
    idempotencyKey: string,
    availableAt?: Date,
  ) {
    const id = randomUUID();
    await tx.$executeRaw`
      INSERT INTO "LoyaltyTransaction" (
        "id", "accountId", "orderId", "type", "status", "points", "availableBalanceAfter",
        "pendingBalanceAfter", "reservedBalanceAfter", "availableAt", "idempotencyKey", "createdAt"
      ) VALUES (
        ${id}::uuid, ${accountId}::uuid, ${orderId ?? null}::uuid, ${type}::"LoyaltyTransactionType",
        ${status}::"LoyaltyTransactionStatus", ${points}, ${available}, ${pending}, ${reserved},
        ${availableAt ?? null}, ${idempotencyKey}, CURRENT_TIMESTAMP
      )
    `;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM "LoyaltyTransaction" WHERE "id" = ${id}::uuid
    `;
    return rows[0];
  }
}
