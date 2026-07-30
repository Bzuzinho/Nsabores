import { createHash, randomUUID } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LoyaltyLedgerService } from './loyalty-ledger.service';
import { LoyaltyReversalService } from './loyalty-reversal.service';

const normalizeCode = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const hashCode = (value: string) => createHash('sha256').update(normalizeCode(value)).digest('hex');

type LoyaltyApplication = {
  id: string;
  orderId: string;
  userId: string;
  points: number;
  amountCents: number;
  status: string;
};

type GiftCardApplication = {
  id: string;
  orderId: string;
  giftCardId: string;
  codeLast4: string;
  amountCents: number;
  status: string;
};

@Injectable()
export class LoyaltyOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LoyaltyLedgerService,
    private readonly reversals: LoyaltyReversalService,
  ) {}

  async reserve(
    orderId: string,
    userId: string | undefined,
    grossTotalCents: number,
    requestedPoints?: number,
    giftCardCode?: string,
  ) {
    const existing = await this.applications(orderId);
    if (existing.loyalty || existing.giftCard) return existing;

    let remaining = grossTotalCents;
    let loyaltyReserved = 0;
    let giftCardReserved = 0;
    let giftCardId: string | undefined;
    let codeLast4: string | undefined;

    try {
      if (requestedPoints) {
        if (!userId) throw new ConflictException('É necessário iniciar sessão para utilizar pontos.');
        loyaltyReserved = Math.min(requestedPoints, remaining);
        if (loyaltyReserved > 0) {
          await this.ledger.reservePoints(
            userId,
            loyaltyReserved,
            `order:${orderId}:loyalty:reserve`,
            orderId,
          );
          remaining -= loyaltyReserved;
        }
      }

      if (giftCardCode && remaining > 0) {
        const cards = await this.prisma.$queryRaw<
          Array<{
            id: string;
            codeLast4: string;
            status: string;
            balanceCents: number;
            expiresAt: Date | null;
          }>
        >`
          SELECT "id", "codeLast4", "status"::text AS "status", "balanceCents", "expiresAt"
          FROM "GiftCard" WHERE "codeHash" = ${hashCode(giftCardCode)} LIMIT 1
        `;
        const card = cards[0];
        if (!card) throw new NotFoundException('Vale-oferta não encontrado.');
        if (card.status !== 'ACTIVE') throw new ConflictException('O vale-oferta não está ativo.');
        if (card.expiresAt && card.expiresAt <= new Date()) {
          throw new ConflictException('O vale-oferta expirou.');
        }
        giftCardReserved = Math.min(card.balanceCents, remaining);
        if (giftCardReserved <= 0) throw new ConflictException('O vale-oferta não tem saldo disponível.');
        giftCardId = card.id;
        codeLast4 = card.codeLast4;
        await this.ledger.reserveGiftCard(
          giftCardId,
          giftCardReserved,
          `order:${orderId}:gift-card:reserve`,
          orderId,
        );
        remaining -= giftCardReserved;
      }

      await this.prisma.$transaction(async (tx) => {
        if (loyaltyReserved > 0 && userId) {
          await tx.$executeRaw`
            INSERT INTO "OrderLoyaltyApplication" (
              "id", "orderId", "userId", "points", "amountCents", "status", "createdAt", "updatedAt"
            ) VALUES (
              ${randomUUID()}::uuid, ${orderId}::uuid, ${userId}::uuid, ${loyaltyReserved},
              ${loyaltyReserved}, 'RESERVED'::"OrderBenefitStatus", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            ) ON CONFLICT ("orderId") DO NOTHING
          `;
        }
        if (giftCardReserved > 0 && giftCardId && codeLast4) {
          await tx.$executeRaw`
            INSERT INTO "OrderGiftCardApplication" (
              "id", "orderId", "giftCardId", "codeLast4", "amountCents", "status", "createdAt", "updatedAt"
            ) VALUES (
              ${randomUUID()}::uuid, ${orderId}::uuid, ${giftCardId}::uuid, ${codeLast4},
              ${giftCardReserved}, 'RESERVED'::"OrderBenefitStatus", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            ) ON CONFLICT ("orderId") DO NOTHING
          `;
        }
        await tx.order.update({
          where: { id: orderId },
          data: {
            discountCents: { increment: loyaltyReserved + giftCardReserved },
            totalCents: remaining,
          },
        });
      });
    } catch (error) {
      if (giftCardReserved > 0 && giftCardId) {
        await this.ledger
          .releaseGiftCard(
            giftCardId,
            giftCardReserved,
            `order:${orderId}:gift-card:rollback`,
            orderId,
          )
          .catch(() => undefined);
      }
      if (loyaltyReserved > 0 && userId) {
        await this.ledger
          .releaseReservedPoints(
            userId,
            loyaltyReserved,
            `order:${orderId}:loyalty:rollback`,
            orderId,
          )
          .catch(() => undefined);
      }
      throw error;
    }

    return this.applications(orderId);
  }

  async consume(orderId: string) {
    const applications = await this.applications(orderId);
    if (applications.loyalty?.status === 'RESERVED') {
      await this.ledger.settleReservedPoints(
        applications.loyalty.userId,
        applications.loyalty.points,
        `order:${orderId}:loyalty:consume`,
        orderId,
      );
      await this.updateLoyaltyStatus(orderId, 'CONSUMED');
    }
    if (applications.giftCard?.status === 'RESERVED') {
      await this.ledger.settleGiftCard(
        applications.giftCard.giftCardId,
        applications.giftCard.amountCents,
        `order:${orderId}:gift-card:consume`,
        orderId,
      );
      await this.updateGiftCardStatus(orderId, 'CONSUMED');
    }
    return this.applications(orderId);
  }

  async release(orderId: string) {
    const applications = await this.applications(orderId);
    if (applications.loyalty?.status === 'RESERVED') {
      await this.ledger.releaseReservedPoints(
        applications.loyalty.userId,
        applications.loyalty.points,
        `order:${orderId}:loyalty:release`,
        orderId,
      );
      await this.updateLoyaltyStatus(orderId, 'RELEASED');
    }
    if (applications.giftCard?.status === 'RESERVED') {
      await this.ledger.releaseGiftCard(
        applications.giftCard.giftCardId,
        applications.giftCard.amountCents,
        `order:${orderId}:gift-card:release`,
        orderId,
      );
      await this.updateGiftCardStatus(orderId, 'RELEASED');
    }
    return this.applications(orderId);
  }

  async refund(orderId: string) {
    const applications = await this.applications(orderId);
    if (applications.loyalty?.status === 'CONSUMED') {
      await this.reversals.refundPoints(
        applications.loyalty.userId,
        applications.loyalty.points,
        `order:${orderId}:loyalty:refund`,
        orderId,
      );
      await this.updateLoyaltyStatus(orderId, 'REFUNDED');
    }
    if (applications.giftCard?.status === 'CONSUMED') {
      await this.reversals.refundGiftCard(
        applications.giftCard.giftCardId,
        applications.giftCard.amountCents,
        `order:${orderId}:gift-card:refund`,
        orderId,
      );
      await this.updateGiftCardStatus(orderId, 'REFUNDED');
    }
    return this.applications(orderId);
  }

  applications(orderId: string) {
    return Promise.all([
      this.prisma.$queryRaw<LoyaltyApplication[]>`
        SELECT * FROM "OrderLoyaltyApplication" WHERE "orderId" = ${orderId}::uuid LIMIT 1
      `,
      this.prisma.$queryRaw<GiftCardApplication[]>`
        SELECT * FROM "OrderGiftCardApplication" WHERE "orderId" = ${orderId}::uuid LIMIT 1
      `,
    ]).then(([loyalty, giftCard]) => ({
      loyalty: loyalty[0] ?? null,
      giftCard: giftCard[0] ?? null,
    }));
  }

  private updateLoyaltyStatus(orderId: string, status: string) {
    return this.prisma.$executeRaw`
      UPDATE "OrderLoyaltyApplication" SET "status" = ${status}::"OrderBenefitStatus",
        "updatedAt" = CURRENT_TIMESTAMP WHERE "orderId" = ${orderId}::uuid
    `;
  }

  private updateGiftCardStatus(orderId: string, status: string) {
    return this.prisma.$executeRaw`
      UPDATE "OrderGiftCardApplication" SET "status" = ${status}::"OrderBenefitStatus",
        "updatedAt" = CURRENT_TIMESTAMP WHERE "orderId" = ${orderId}::uuid
    `;
  }
}
