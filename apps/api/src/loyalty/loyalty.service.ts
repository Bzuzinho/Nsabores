import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import type {
  GiftCardBlockDto,
  IssueGiftCardDto,
  LoyaltyAdjustmentDto,
  LoyaltyRuleDto,
} from './dto';

const serializable = { isolationLevel: 'Serializable' as const };
const normalizeCode = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
const hashCode = (value: string) =>
  createHash('sha256').update(normalizeCode(value)).digest('hex');

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  async account(userId: string) {
    await this.ensureAccount(userId);
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM "LoyaltyAccount" WHERE "userId" = ${userId}::uuid LIMIT 1
    `;
    const account = rows[0];
    if (!account)
      throw new NotFoundException('Conta de fidelização não encontrada.');
    const transactions = await this.prisma.$queryRaw<
      Array<Record<string, unknown>>
    >`
      SELECT * FROM "LoyaltyTransaction"
      WHERE "accountId" = ${account.id as string}::uuid
      ORDER BY "createdAt" DESC LIMIT 100
    `;
    return { ...account, transactions };
  }

  async adjust(userId: string, body: LoyaltyAdjustmentDto, authorId?: string) {
    if (!body.points)
      throw new BadRequestException('O ajuste não pode ser zero.');
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM "LoyaltyTransaction" WHERE "idempotencyKey" = ${body.idempotencyKey} LIMIT 1
      `;
      if (duplicate[0]) return duplicate[0];
      const account = await this.ensureAccount(userId, tx, true);
      const nextAvailable = account.availablePoints + body.points;
      if (nextAvailable < 0)
        throw new ConflictException('Saldo de pontos insuficiente.');
      await tx.$executeRaw`
        UPDATE "LoyaltyAccount"
        SET "availablePoints" = ${nextAvailable},
            "lifetimeEarnedPoints" = "lifetimeEarnedPoints" + ${Math.max(0, body.points)},
            "lifetimeRedeemedPoints" = "lifetimeRedeemedPoints" + ${Math.max(0, -body.points)},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${account.id}::uuid
      `;
      const id = randomUUID();
      await tx.$executeRaw`
        INSERT INTO "LoyaltyTransaction" (
          "id", "accountId", "type", "status", "points", "availableBalanceAfter",
          "pendingBalanceAfter", "reservedBalanceAfter", "idempotencyKey", "note", "metadata", "createdAt"
        ) VALUES (
          ${id}::uuid, ${account.id}::uuid, 'ADJUSTMENT'::"LoyaltyTransactionType",
          'COMPLETED'::"LoyaltyTransactionStatus", ${body.points}, ${nextAvailable},
          ${account.pendingPoints}, ${account.reservedPoints}, ${body.idempotencyKey}, ${body.note},
          ${JSON.stringify({ authorId: authorId ?? null })}::jsonb, CURRENT_TIMESTAMP
        )
      `;
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM "LoyaltyTransaction" WHERE "id" = ${id}::uuid
      `;
      return rows[0];
    }, serializable);
  }

  rules() {
    return this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM "LoyaltyRule" ORDER BY "createdAt" DESC
    `;
  }

  async createRule(body: LoyaltyRuleDto) {
    const id = randomUUID();
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "LoyaltyRule" (
          "id", "name", "code", "isActive", "channel", "pointsPerEuro",
          "clubMultiplierBasisPoints", "minimumOrderCents", "maximumPointsPerOrder",
          "pendingDays", "validFrom", "validUntil", "configuration", "createdAt", "updatedAt"
        ) VALUES (
          ${id}::uuid, ${body.name.trim()}, ${normalizeCode(body.code)}, ${body.isActive},
          ${body.channel ?? null}::"SalesChannel", ${body.pointsPerEuro}, ${body.clubMultiplierBasisPoints},
          ${body.minimumOrderCents ?? null}, ${body.maximumPointsPerOrder ?? null}, ${body.pendingDays},
          ${body.validFrom ? new Date(body.validFrom) : null}, ${body.validUntil ? new Date(body.validUntil) : null},
          ${JSON.stringify(body.configuration)}::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `;
    } catch (error) {
      if (this.isUnique(error))
        throw new ConflictException('Já existe uma regra com esse código.');
      throw error;
    }
    return this.rule(id);
  }

  async rule(id: string) {
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM "LoyaltyRule" WHERE "id" = ${id}::uuid LIMIT 1
    `;
    if (!rows[0])
      throw new NotFoundException('Regra de fidelização não encontrada.');
    return rows[0];
  }

  async issueGiftCard(body: IssueGiftCardDto, purchaserUserId?: string) {
    const existing = await this.prisma.$queryRaw<
      Array<Record<string, unknown>>
    >`
      SELECT gc.* FROM "GiftCardTransaction" gt
      JOIN "GiftCard" gc ON gc."id" = gt."giftCardId"
      WHERE gt."idempotencyKey" = ${body.idempotencyKey} LIMIT 1
    `;
    if (existing[0]) return existing[0];
    const code = `NS-${randomBytes(8).toString('hex').toUpperCase()}`;
    const giftCardId = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "GiftCard" (
          "id", "codeHash", "codeLast4", "status", "initialAmountCents", "balanceCents",
          "reservedCents", "currency", "purchaserUserId", "recipientEmail", "recipientName",
          "message", "expiresAt", "activatedAt", "createdAt", "updatedAt"
        ) VALUES (
          ${giftCardId}::uuid, ${hashCode(code)}, ${normalizeCode(code).slice(-4)}, 'ACTIVE'::"GiftCardStatus",
          ${body.initialAmountCents}, ${body.initialAmountCents}, 0, 'EUR', ${purchaserUserId ?? null}::uuid,
          ${body.recipientEmail?.toLowerCase() ?? null}, ${body.recipientName ?? null}, ${body.message ?? null},
          ${body.expiresAt ? new Date(body.expiresAt) : null}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `;
      await tx.$executeRaw`
        INSERT INTO "GiftCardTransaction" (
          "id", "giftCardId", "type", "status", "amountCents", "balanceAfterCents",
          "reservedAfterCents", "idempotencyKey", "note", "createdAt"
        ) VALUES (
          ${randomUUID()}::uuid, ${giftCardId}::uuid, 'ISSUE'::"GiftCardTransactionType",
          'COMPLETED'::"GiftCardTransactionStatus", ${body.initialAmountCents}, ${body.initialAmountCents},
          0, ${body.idempotencyKey}, 'Vale-oferta emitido.', CURRENT_TIMESTAMP
        )
      `;
    }, serializable);
    return { ...(await this.giftCardById(giftCardId)), code };
  }

  async lookupGiftCard(code: string) {
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT "id", "codeLast4", "status", "balanceCents", "reservedCents", "currency", "expiresAt"
      FROM "GiftCard" WHERE "codeHash" = ${hashCode(code)} LIMIT 1
    `;
    const card = rows[0];
    if (!card) throw new NotFoundException('Vale-oferta não encontrado.');
    return card;
  }

  async blockGiftCard(id: string, body: GiftCardBlockDto) {
    const changed = await this.prisma.$executeRaw`
      UPDATE "GiftCard" SET "status" = 'BLOCKED'::"GiftCardStatus", "blockedAt" = CURRENT_TIMESTAMP,
        "blockReason" = ${body.reason}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}::uuid AND "status" = 'ACTIVE'::"GiftCardStatus"
    `;
    if (changed !== 1)
      throw new ConflictException('O vale não está ativo ou não existe.');
    return this.giftCardById(id);
  }

  giftCards() {
    return this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT "id", "codeLast4", "status", "initialAmountCents", "balanceCents", "reservedCents",
        "currency", "recipientEmail", "recipientName", "expiresAt", "createdAt"
      FROM "GiftCard" ORDER BY "createdAt" DESC
    `;
  }

  private async giftCardById(id: string) {
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM "GiftCard" WHERE "id" = ${id}::uuid LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('Vale-oferta não encontrado.');
    return rows[0];
  }

  private async ensureAccount(
    userId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
    lock = false,
  ) {
    await client.$executeRaw`
      INSERT INTO "LoyaltyAccount" ("id", "userId", "createdAt", "updatedAt")
      VALUES (${randomUUID()}::uuid, ${userId}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("userId") DO NOTHING
    `;
    const lockSql = lock ? Prisma.sql`FOR UPDATE` : Prisma.empty;
    const rows = await client.$queryRaw<
      Array<{
        id: string;
        availablePoints: number;
        pendingPoints: number;
        reservedPoints: number;
      }>
    >(Prisma.sql`
      SELECT "id", "availablePoints", "pendingPoints", "reservedPoints"
      FROM "LoyaltyAccount" WHERE "userId" = ${userId}::uuid ${lockSql}
    `);
    if (!rows[0])
      throw new NotFoundException('Conta de fidelização não encontrada.');
    return rows[0];
  }

  private isUnique(error: unknown) {
    const text = error instanceof Error ? error.message : String(error);
    return text.includes('23505') || text.toLowerCase().includes('unique');
  }
}
