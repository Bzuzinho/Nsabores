import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { CouponDto, PromotionDto, PromotionTargetDto } from './dto';

interface PromotionRow {
  id: string;
  name: string;
  code: string;
  status: string;
  benefitType: string;
  benefitValue: number;
  channel: string;
  startsAt: Date | null;
  endsAt: Date | null;
  priority: number;
  stackable: boolean;
  globalUsageLimit: number | null;
  perCustomerLimit: number | null;
  minimumCartCents: number | null;
  maximumDiscountCents: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CouponRow {
  id: string;
  promotionId: string;
  code: string;
  isActive: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  channel: string;
  minimumCartCents: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const normalizeCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '-');

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async publicPromotions(channel: 'B2C' | 'B2B' = 'B2C') {
    return this.prisma.$queryRaw<PromotionRow[]>`
      SELECT p.*
      FROM "Promotion" p
      WHERE p."status" = 'ACTIVE'::"PromotionStatus"
        AND p."channel" IN (${channel}::"PromotionChannel", 'BOTH'::"PromotionChannel")
        AND (p."startsAt" IS NULL OR p."startsAt" <= CURRENT_TIMESTAMP)
        AND (p."endsAt" IS NULL OR p."endsAt" >= CURRENT_TIMESTAMP)
      ORDER BY p."priority" DESC, p."createdAt" ASC
    `;
  }

  promotions() {
    return this.prisma.$queryRaw<PromotionRow[]>`
      SELECT * FROM "Promotion" ORDER BY "createdAt" DESC
    `;
  }

  async promotion(id: string) {
    const rows = await this.prisma.$queryRaw<PromotionRow[]>`
      SELECT * FROM "Promotion" WHERE "id" = ${id}::uuid LIMIT 1
    `;
    const promotion = rows[0];
    if (!promotion) throw new NotFoundException('Promoção não encontrada.');
    const [targets, coupons] = await Promise.all([
      this.prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM "PromotionTarget" WHERE "promotionId" = ${id}::uuid ORDER BY "createdAt" ASC
      `,
      this.prisma.$queryRaw<CouponRow[]>`
        SELECT * FROM "Coupon" WHERE "promotionId" = ${id}::uuid ORDER BY "createdAt" ASC
      `,
    ]);
    return { ...promotion, targets, coupons };
  }

  async createPromotion(body: PromotionDto) {
    const code = normalizeCode(body.code);
    if (!code) throw new BadRequestException('Código da promoção inválido.');
    this.validateDates(body.startsAt, body.endsAt);
    const id = randomUUID();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO "Promotion" (
            "id", "name", "code", "status", "benefitType", "benefitValue", "channel",
            "startsAt", "endsAt", "priority", "stackable", "globalUsageLimit",
            "perCustomerLimit", "minimumCartCents", "maximumDiscountCents", "createdAt", "updatedAt"
          ) VALUES (
            ${id}::uuid, ${body.name.trim()}, ${code}, ${body.status}::"PromotionStatus",
            ${body.benefitType}::"PromotionBenefitType", ${body.benefitValue},
            ${body.channel}::"PromotionChannel", ${body.startsAt ? new Date(body.startsAt) : null},
            ${body.endsAt ? new Date(body.endsAt) : null}, ${body.priority}, ${body.stackable},
            ${body.globalUsageLimit ?? null}, ${body.perCustomerLimit ?? null},
            ${body.minimumCartCents ?? null}, ${body.maximumDiscountCents ?? null},
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;
        await this.replaceTargets(tx, id, body.targets ?? []);
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('Já existe uma promoção com esse código.');
      throw error;
    }
    return this.promotion(id);
  }

  async updatePromotion(id: string, body: PromotionDto) {
    await this.promotion(id);
    const code = normalizeCode(body.code);
    this.validateDates(body.startsAt, body.endsAt);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE "Promotion" SET
            "name" = ${body.name.trim()}, "code" = ${code},
            "status" = ${body.status}::"PromotionStatus",
            "benefitType" = ${body.benefitType}::"PromotionBenefitType",
            "benefitValue" = ${body.benefitValue}, "channel" = ${body.channel}::"PromotionChannel",
            "startsAt" = ${body.startsAt ? new Date(body.startsAt) : null},
            "endsAt" = ${body.endsAt ? new Date(body.endsAt) : null},
            "priority" = ${body.priority}, "stackable" = ${body.stackable},
            "globalUsageLimit" = ${body.globalUsageLimit ?? null},
            "perCustomerLimit" = ${body.perCustomerLimit ?? null},
            "minimumCartCents" = ${body.minimumCartCents ?? null},
            "maximumDiscountCents" = ${body.maximumDiscountCents ?? null},
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${id}::uuid
        `;
        await tx.$executeRaw`DELETE FROM "PromotionTarget" WHERE "promotionId" = ${id}::uuid`;
        await this.replaceTargets(tx, id, body.targets ?? []);
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('Já existe uma promoção com esse código.');
      throw error;
    }
    return this.promotion(id);
  }

  async coupons() {
    return this.prisma.$queryRaw<Array<CouponRow & { promotionName: string; promotionCode: string }>>`
      SELECT c.*, p."name" AS "promotionName", p."code" AS "promotionCode"
      FROM "Coupon" c JOIN "Promotion" p ON p."id" = c."promotionId"
      ORDER BY c."createdAt" DESC
    `;
  }

  async createCoupon(body: CouponDto) {
    await this.promotion(body.promotionId);
    this.validateDates(body.validFrom, body.validUntil);
    const code = normalizeCode(body.code);
    const id = randomUUID();
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "Coupon" (
          "id", "promotionId", "code", "isActive", "validFrom", "validUntil",
          "usageLimit", "perUserLimit", "channel", "minimumCartCents", "createdAt", "updatedAt"
        ) VALUES (
          ${id}::uuid, ${body.promotionId}::uuid, ${code}, ${body.isActive},
          ${body.validFrom ? new Date(body.validFrom) : null}, ${body.validUntil ? new Date(body.validUntil) : null},
          ${body.usageLimit ?? null}, ${body.perUserLimit ?? null},
          ${body.channel}::"PromotionChannel", ${body.minimumCartCents ?? null},
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `;
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('Já existe um cupão com esse código.');
      throw error;
    }
    return this.coupon(id);
  }

  async coupon(id: string) {
    const rows = await this.prisma.$queryRaw<CouponRow[]>`
      SELECT * FROM "Coupon" WHERE "id" = ${id}::uuid LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('Cupão não encontrado.');
    return rows[0];
  }

  async updateCoupon(id: string, body: CouponDto) {
    await this.coupon(id);
    await this.promotion(body.promotionId);
    this.validateDates(body.validFrom, body.validUntil);
    const code = normalizeCode(body.code);
    try {
      await this.prisma.$executeRaw`
        UPDATE "Coupon" SET
          "promotionId" = ${body.promotionId}::uuid, "code" = ${code}, "isActive" = ${body.isActive},
          "validFrom" = ${body.validFrom ? new Date(body.validFrom) : null},
          "validUntil" = ${body.validUntil ? new Date(body.validUntil) : null},
          "usageLimit" = ${body.usageLimit ?? null}, "perUserLimit" = ${body.perUserLimit ?? null},
          "channel" = ${body.channel}::"PromotionChannel", "minimumCartCents" = ${body.minimumCartCents ?? null},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${id}::uuid
      `;
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('Já existe um cupão com esse código.');
      throw error;
    }
    return this.coupon(id);
  }

  private async replaceTargets(
    tx: Pick<PrismaService, '$executeRaw'>,
    promotionId: string,
    targets: PromotionTargetDto[],
  ) {
    for (const target of targets) {
      if (!target.productId && !target.categoryId && !target.priceListId && !target.businessAccountId && !target.minimumQuantity) {
        throw new BadRequestException('Alvo de promoção vazio.');
      }
      await tx.$executeRaw`
        INSERT INTO "PromotionTarget" (
          "id", "promotionId", "productId", "categoryId", "priceListId", "businessAccountId", "minimumQuantity", "createdAt"
        ) VALUES (
          ${randomUUID()}::uuid, ${promotionId}::uuid, ${target.productId ?? null}::uuid,
          ${target.categoryId ?? null}::uuid, ${target.priceListId ?? null}::uuid,
          ${target.businessAccountId ?? null}::uuid, ${target.minimumQuantity ?? null}, CURRENT_TIMESTAMP
        )
      `;
    }
  }

  private validateDates(from?: string, until?: string) {
    const start = from ? new Date(from) : null;
    const end = until ? new Date(until) : null;
    if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
      throw new BadRequestException('Data inválida.');
    }
    if (start && end && end <= start) throw new BadRequestException('A data final tem de ser posterior à inicial.');
  }

  private isUniqueViolation(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
  }
}
