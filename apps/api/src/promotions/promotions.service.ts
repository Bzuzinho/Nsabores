import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

interface PromotionTargetRow {
  productId: string | null;
  categoryId: string | null;
  priceListId: string | null;
  businessAccountId: string | null;
  minimumQuantity: number | null;
}

interface PricingContext {
  channel: 'B2C' | 'B2B';
  businessAccountId: string | null;
  priceListId: string | null;
  paymentTerms: string | null;
  requiresApproval: boolean;
}

interface PricingItemRow {
  id: string;
  productId: string;
  quantity: number;
  unitPriceCents: number;
  categoryId: string;
  name: string;
  slug: string;
  sku: string;
  imageUrl: string;
  stockStatus: string;
}

interface PromotionCandidate extends PromotionRow {
  couponId: string | null;
  couponCode: string | null;
  source: 'AUTOMATIC' | 'COUPON';
}

export interface PricingDiscount {
  promotionId: string;
  couponId: string | null;
  source: 'AUTOMATIC' | 'COUPON';
  code: string | null;
  label: string;
  amountCents: number;
  freeShipping: boolean;
  snapshot: Record<string, unknown>;
}

export interface CartPricingResult {
  id: string;
  status: string;
  context: PricingContext;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
    product: {
      id: string;
      name: string;
      slug: string;
      sku: string;
      imageUrl: string;
      stockStatus: string;
    };
  }>;
  itemCount: number;
  subtotalCents: number;
  productDiscountCents: number;
  shippingDiscountCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  discounts: PricingDiscount[];
  coupon: { id: string; code: string } | null;
}

const normalizeCode = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, '-');

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
    this.validatePromotion(body);
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
      if (this.isUniqueViolation(error))
        throw new ConflictException('Já existe uma promoção com esse código.');
      throw error;
    }
    return this.promotion(id);
  }

  async updatePromotion(id: string, body: PromotionDto) {
    await this.promotion(id);
    const code = normalizeCode(body.code);
    this.validatePromotion(body);
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
      if (this.isUniqueViolation(error))
        throw new ConflictException('Já existe uma promoção com esse código.');
      throw error;
    }
    return this.promotion(id);
  }

  async coupons() {
    return this.prisma.$queryRaw<
      Array<CouponRow & { promotionName: string; promotionCode: string }>
    >`
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
      if (this.isUniqueViolation(error))
        throw new ConflictException('Já existe um cupão com esse código.');
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
      if (this.isUniqueViolation(error))
        throw new ConflictException('Já existe um cupão com esse código.');
      throw error;
    }
    return this.coupon(id);
  }

  async applyCoupon(cartId: string, codeValue: string, userId?: string) {
    const code = normalizeCode(codeValue);
    if (!code) throw new BadRequestException('Indique um código de cupão.');
    const context = await this.pricingContext(this.prisma, userId);
    const subtotalCents = await this.cartSubtotal(this.prisma, cartId, context);
    const rows = await this.prisma.$queryRaw<Array<CouponRow & PromotionRow>>`
      SELECT c."id", c."promotionId", c."code", c."isActive", c."validFrom", c."validUntil",
             c."usageLimit", c."perUserLimit", c."channel", c."minimumCartCents",
             c."createdAt", c."updatedAt",
             p."name", p."status", p."benefitType", p."benefitValue", p."startsAt", p."endsAt",
             p."priority", p."stackable", p."globalUsageLimit", p."perCustomerLimit",
             p."maximumDiscountCents"
      FROM "Coupon" c
      JOIN "Promotion" p ON p."id" = c."promotionId"
      WHERE c."code" = ${code}
      LIMIT 1
    `;
    const coupon = rows[0];
    if (!coupon) throw new BadRequestException('Cupão inválido.');
    await this.assertCouponEligible(coupon, context, subtotalCents, userId);
    await this.prisma.$executeRaw`
      INSERT INTO "CartPromotion" ("id", "cartId", "promotionId", "couponId", "code", "createdAt", "updatedAt")
      VALUES (${randomUUID()}::uuid, ${cartId}::uuid, ${coupon.promotionId}::uuid, ${coupon.id}::uuid, ${code}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("cartId") DO UPDATE SET
        "promotionId" = EXCLUDED."promotionId",
        "couponId" = EXCLUDED."couponId",
        "code" = EXCLUDED."code",
        "updatedAt" = CURRENT_TIMESTAMP
    `;
    return this.priceCart(cartId, userId);
  }

  async removeCoupon(cartId: string, userId?: string) {
    await this.prisma.$executeRaw`
      DELETE FROM "CartPromotion" WHERE "cartId" = ${cartId}::uuid
    `;
    return this.priceCart(cartId, userId);
  }

  priceCart(cartId: string, userId?: string, shippingCents = 0) {
    return this.priceCartWithClient(
      this.prisma as unknown as Prisma.TransactionClient,
      cartId,
      userId,
      shippingCents,
    );
  }

  priceCartInTransaction(
    tx: Prisma.TransactionClient,
    cartId: string,
    userId?: string,
    shippingCents = 0,
  ) {
    return this.priceCartWithClient(tx, cartId, userId, shippingCents);
  }

  async snapshotOrderDiscounts(
    tx: Prisma.TransactionClient,
    orderId: string,
    discounts: PricingDiscount[],
  ) {
    for (const discount of discounts) {
      await tx.$executeRaw`
        INSERT INTO "OrderDiscount" (
          "id", "orderId", "promotionId", "couponId", "source", "code", "label",
          "amountCents", "snapshot", "createdAt"
        ) VALUES (
          ${randomUUID()}::uuid, ${orderId}::uuid, ${discount.promotionId}::uuid,
          ${discount.couponId}::uuid, ${discount.source}, ${discount.code}, ${discount.label},
          ${discount.amountCents}, ${JSON.stringify(discount.snapshot)}::jsonb, CURRENT_TIMESTAMP
        )
      `;
    }
  }

  async orderDiscounts(orderId: string) {
    return this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT "id", "promotionId", "couponId", "source", "code", "label", "amountCents", "snapshot", "createdAt"
      FROM "OrderDiscount"
      WHERE "orderId" = ${orderId}::uuid
      ORDER BY "createdAt" ASC
    `;
  }

  private async priceCartWithClient(
    client: Prisma.TransactionClient,
    cartId: string,
    userId?: string,
    shippingCents = 0,
  ): Promise<CartPricingResult> {
    const cartRows = await client.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT "id", "status"::text AS "status" FROM "Cart" WHERE "id" = ${cartId}::uuid LIMIT 1
    `;
    if (!cartRows[0]) throw new NotFoundException('Carrinho não encontrado.');
    const context = await this.pricingContext(client, userId);
    const items = await this.pricingItems(client, cartId, context);
    const subtotalCents = items.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0,
    );
    const candidates = await this.promotionCandidates(
      client,
      cartId,
      context,
      subtotalCents,
      userId,
    );
    const discounts: PricingDiscount[] = [];
    let productDiscountCents = 0;
    let shippingDiscountCents = 0;

    for (const candidate of candidates) {
      const eligible = await this.eligibleItems(client, candidate, items, context);
      if (!eligible.length && candidate.benefitType !== 'FREE_SHIPPING') continue;
      const eligibleSubtotal = eligible.reduce(
        (sum, item) => sum + item.unitPriceCents * item.quantity,
        0,
      );
      let amountCents = 0;
      let freeShipping = false;
      switch (candidate.benefitType) {
        case 'PERCENTAGE':
          amountCents = Math.round((eligibleSubtotal * candidate.benefitValue) / 100);
          break;
        case 'FIXED_AMOUNT':
          amountCents = Math.min(candidate.benefitValue, eligibleSubtotal);
          break;
        case 'SPECIAL_PRICE':
          amountCents = eligible.reduce(
            (sum, item) =>
              sum +
              Math.max(0, item.unitPriceCents - candidate.benefitValue) *
                item.quantity,
            0,
          );
          break;
        case 'FREE_SHIPPING':
          amountCents = shippingCents;
          freeShipping = true;
          break;
        case 'QUANTITY_DEAL':
          continue;
        default:
          continue;
      }
      if (candidate.maximumDiscountCents !== null) {
        amountCents = Math.min(amountCents, candidate.maximumDiscountCents);
      }
      if (!freeShipping) {
        amountCents = Math.min(
          amountCents,
          Math.max(0, subtotalCents - productDiscountCents),
        );
      }
      if (amountCents <= 0 && !freeShipping) continue;
      const line: PricingDiscount = {
        promotionId: candidate.id,
        couponId: candidate.couponId,
        source: candidate.source,
        code: candidate.couponCode,
        label: candidate.name,
        amountCents,
        freeShipping,
        snapshot: {
          promotionCode: candidate.code,
          benefitType: candidate.benefitType,
          benefitValue: candidate.benefitValue,
          channel: candidate.channel,
          priority: candidate.priority,
          stackable: candidate.stackable,
          eligibleProductIds: eligible.map((item) => item.productId),
        },
      };
      discounts.push(line);
      if (freeShipping) shippingDiscountCents = Math.max(shippingDiscountCents, amountCents);
      else productDiscountCents += amountCents;
      if (!candidate.stackable) break;
    }

    const discountCents = Math.min(
      subtotalCents + shippingCents,
      productDiscountCents + shippingDiscountCents,
    );
    const couponDiscount = discounts.find((line) => line.couponId !== null);
    return {
      id: cartRows[0].id,
      status: cartRows[0].status,
      context,
      items: items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        totalCents: item.unitPriceCents * item.quantity,
        product: {
          id: item.productId,
          name: item.name,
          slug: item.slug,
          sku: item.sku,
          imageUrl: item.imageUrl,
          stockStatus: item.stockStatus,
        },
      })),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotalCents,
      productDiscountCents,
      shippingDiscountCents,
      discountCents,
      shippingCents,
      totalCents: Math.max(0, subtotalCents + shippingCents - discountCents),
      discounts,
      coupon: couponDiscount?.couponId
        ? { id: couponDiscount.couponId, code: couponDiscount.code ?? '' }
        : null,
    };
  }

  private async pricingContext(
    client: Prisma.TransactionClient | PrismaService,
    userId?: string,
  ): Promise<PricingContext> {
    if (!userId) {
      return {
        channel: 'B2C',
        businessAccountId: null,
        priceListId: null,
        paymentTerms: null,
        requiresApproval: false,
      };
    }
    const rows = await client.$queryRaw<
      Array<{
        businessAccountId: string;
        priceListId: string | null;
        paymentTerms: string;
        requiresApproval: boolean;
      }>
    >`
      SELECT ba."id" AS "businessAccountId", ba."priceListId", ba."paymentTerms"::text AS "paymentTerms",
             ba."requiresApproval"
      FROM "BusinessAccountUser" bau
      JOIN "BusinessAccount" ba ON ba."id" = bau."businessAccountId"
      WHERE bau."userId" = ${userId}::uuid
        AND bau."isActive" = true
        AND ba."status" = 'APPROVED'::"BusinessAccountStatus"
      ORDER BY bau."createdAt" ASC
      LIMIT 1
    `;
    const account = rows[0];
    return account
      ? {
          channel: 'B2B',
          businessAccountId: account.businessAccountId,
          priceListId: account.priceListId,
          paymentTerms: account.paymentTerms,
          requiresApproval: account.requiresApproval,
        }
      : {
          channel: 'B2C',
          businessAccountId: null,
          priceListId: null,
          paymentTerms: null,
          requiresApproval: false,
        };
  }

  private async pricingItems(
    client: Prisma.TransactionClient,
    cartId: string,
    context: PricingContext,
  ) {
    return client.$queryRaw<PricingItemRow[]>`
      SELECT ci."id", ci."productId", ci."quantity", p."categoryId", p."name", p."slug", p."sku",
             p."imageUrl", p."stockStatus"::text AS "stockStatus",
             COALESCE(
               CASE
                 WHEN pli."promotionalPriceCents" IS NOT NULL
                   AND (pli."validFrom" IS NULL OR pli."validFrom" <= CURRENT_TIMESTAMP)
                   AND (pli."validUntil" IS NULL OR pli."validUntil" >= CURRENT_TIMESTAMP)
                 THEN pli."promotionalPriceCents"
                 WHEN pli."priceCents" IS NOT NULL
                   AND (pli."validFrom" IS NULL OR pli."validFrom" <= CURRENT_TIMESTAMP)
                   AND (pli."validUntil" IS NULL OR pli."validUntil" >= CURRENT_TIMESTAMP)
                 THEN pli."priceCents"
                 ELSE NULL
               END,
               p."priceCents"
             )::int AS "unitPriceCents"
      FROM "CartItem" ci
      JOIN "Product" p ON p."id" = ci."productId"
      LEFT JOIN "PriceListItem" pli
        ON pli."productId" = p."id"
       AND pli."priceListId" = ${context.priceListId}::uuid
      WHERE ci."cartId" = ${cartId}::uuid
      ORDER BY ci."createdAt" ASC
    `;
  }

  private async cartSubtotal(
    client: PrismaService,
    cartId: string,
    context: PricingContext,
  ) {
    const items = await this.pricingItems(
      client as unknown as Prisma.TransactionClient,
      cartId,
      context,
    );
    return items.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0,
    );
  }

  private async promotionCandidates(
    client: Prisma.TransactionClient,
    cartId: string,
    context: PricingContext,
    subtotalCents: number,
    userId?: string,
  ): Promise<PromotionCandidate[]> {
    const automatic = await client.$queryRaw<PromotionRow[]>`
      SELECT p.*
      FROM "Promotion" p
      WHERE p."status" = 'ACTIVE'::"PromotionStatus"
        AND p."channel" IN (${context.channel}::"PromotionChannel", 'BOTH'::"PromotionChannel")
        AND (p."startsAt" IS NULL OR p."startsAt" <= CURRENT_TIMESTAMP)
        AND (p."endsAt" IS NULL OR p."endsAt" >= CURRENT_TIMESTAMP)
        AND (p."minimumCartCents" IS NULL OR p."minimumCartCents" <= ${subtotalCents})
        AND NOT EXISTS (SELECT 1 FROM "Coupon" c WHERE c."promotionId" = p."id")
      ORDER BY p."priority" DESC, p."createdAt" ASC
    `;
    const couponRows = await client.$queryRaw<
      Array<CouponRow & PromotionRow>
    >`
      SELECT c."id", c."promotionId", c."code", c."isActive", c."validFrom", c."validUntil",
             c."usageLimit", c."perUserLimit", c."channel", c."minimumCartCents",
             c."createdAt", c."updatedAt",
             p."name", p."status", p."benefitType", p."benefitValue", p."startsAt", p."endsAt",
             p."priority", p."stackable", p."globalUsageLimit", p."perCustomerLimit",
             p."maximumDiscountCents"
      FROM "CartPromotion" cp
      JOIN "Coupon" c ON c."id" = cp."couponId"
      JOIN "Promotion" p ON p."id" = cp."promotionId"
      WHERE cp."cartId" = ${cartId}::uuid
      LIMIT 1
    `;
    const candidates: PromotionCandidate[] = automatic.map((promotion) => ({
      ...promotion,
      couponId: null,
      couponCode: null,
      source: 'AUTOMATIC',
    }));
    if (couponRows[0]) {
      await this.assertCouponEligible(
        couponRows[0],
        context,
        subtotalCents,
        userId,
        client,
      );
      candidates.push({
        ...couponRows[0],
        id: couponRows[0].promotionId,
        code: couponRows[0].code,
        couponId: couponRows[0].id,
        couponCode: couponRows[0].code,
        source: 'COUPON',
      });
    }
    const eligible: PromotionCandidate[] = [];
    for (const candidate of candidates) {
      if (await this.usageAvailable(client, candidate, userId, context.businessAccountId)) {
        eligible.push(candidate);
      }
    }
    return eligible.sort((a, b) => b.priority - a.priority || a.createdAt.getTime() - b.createdAt.getTime());
  }

  private async eligibleItems(
    client: Prisma.TransactionClient,
    promotion: PromotionCandidate,
    items: PricingItemRow[],
    context: PricingContext,
  ) {
    const targets = await client.$queryRaw<PromotionTargetRow[]>`
      SELECT "productId", "categoryId", "priceListId", "businessAccountId", "minimumQuantity"
      FROM "PromotionTarget"
      WHERE "promotionId" = ${promotion.id}::uuid
    `;
    if (!targets.length) return items;
    const eligible = new Map<string, PricingItemRow>();
    for (const target of targets) {
      if (target.priceListId && target.priceListId !== context.priceListId) continue;
      if (
        target.businessAccountId &&
        target.businessAccountId !== context.businessAccountId
      )
        continue;
      const matched = items.filter(
        (item) =>
          (!target.productId || target.productId === item.productId) &&
          (!target.categoryId || target.categoryId === item.categoryId),
      );
      const quantity = matched.reduce((sum, item) => sum + item.quantity, 0);
      if (target.minimumQuantity && quantity < target.minimumQuantity) continue;
      for (const item of matched) eligible.set(item.productId, item);
    }
    return [...eligible.values()];
  }

  private async assertCouponEligible(
    coupon: CouponRow & Partial<PromotionRow>,
    context: PricingContext,
    subtotalCents: number,
    userId?: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const now = Date.now();
    if (!coupon.isActive || coupon.status !== 'ACTIVE')
      throw new BadRequestException('Cupão indisponível.');
    if (coupon.validFrom && coupon.validFrom.getTime() > now)
      throw new BadRequestException('O cupão ainda não está ativo.');
    if (coupon.validUntil && coupon.validUntil.getTime() < now)
      throw new BadRequestException('O cupão expirou.');
    if (coupon.startsAt && coupon.startsAt.getTime() > now)
      throw new BadRequestException('A promoção ainda não está ativa.');
    if (coupon.endsAt && coupon.endsAt.getTime() < now)
      throw new BadRequestException('A promoção terminou.');
    if (coupon.channel !== 'BOTH' && coupon.channel !== context.channel)
      throw new BadRequestException('O cupão não é válido neste canal.');
    if (coupon.minimumCartCents && subtotalCents < coupon.minimumCartCents)
      throw new BadRequestException('O carrinho não atinge o valor mínimo do cupão.');
    if (coupon.perUserLimit && !userId)
      throw new BadRequestException('Este cupão requer autenticação.');
    if (coupon.usageLimit) {
      const rows = await client.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS "count"
        FROM "OrderDiscount" od
        JOIN "Order" o ON o."id" = od."orderId"
        WHERE od."couponId" = ${coupon.id}::uuid
          AND o."status" <> 'CANCELLED'::"OrderStatus"
      `;
      if ((rows[0]?.count ?? 0) >= coupon.usageLimit)
        throw new BadRequestException('O limite de utilização do cupão foi atingido.');
    }
    if (coupon.perUserLimit && userId) {
      const rows = await client.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS "count"
        FROM "OrderDiscount" od
        JOIN "Order" o ON o."id" = od."orderId"
        WHERE od."couponId" = ${coupon.id}::uuid
          AND o."userId" = ${userId}::uuid
          AND o."status" <> 'CANCELLED'::"OrderStatus"
      `;
      if ((rows[0]?.count ?? 0) >= coupon.perUserLimit)
        throw new BadRequestException('Já atingiu o limite de utilização deste cupão.');
    }
  }

  private async usageAvailable(
    client: Prisma.TransactionClient,
    promotion: PromotionCandidate,
    userId?: string,
    businessAccountId?: string | null,
  ) {
    if (promotion.globalUsageLimit) {
      const rows = await client.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS "count"
        FROM "OrderDiscount" od
        JOIN "Order" o ON o."id" = od."orderId"
        WHERE od."promotionId" = ${promotion.id}::uuid
          AND o."status" <> 'CANCELLED'::"OrderStatus"
      `;
      if ((rows[0]?.count ?? 0) >= promotion.globalUsageLimit) return false;
    }
    if (promotion.perCustomerLimit && (userId || businessAccountId)) {
      const rows = businessAccountId
        ? await client.$queryRaw<Array<{ count: number }>>`
            SELECT COUNT(*)::int AS "count"
            FROM "OrderDiscount" od
            JOIN "Order" o ON o."id" = od."orderId"
            WHERE od."promotionId" = ${promotion.id}::uuid
              AND o."businessAccountId" = ${businessAccountId}::uuid
              AND o."status" <> 'CANCELLED'::"OrderStatus"
          `
        : await client.$queryRaw<Array<{ count: number }>>`
            SELECT COUNT(*)::int AS "count"
            FROM "OrderDiscount" od
            JOIN "Order" o ON o."id" = od."orderId"
            WHERE od."promotionId" = ${promotion.id}::uuid
              AND o."userId" = ${userId}::uuid
              AND o."status" <> 'CANCELLED'::"OrderStatus"
          `;
      if ((rows[0]?.count ?? 0) >= promotion.perCustomerLimit) return false;
    }
    return true;
  }

  private async replaceTargets(
    tx: Prisma.TransactionClient,
    promotionId: string,
    targets: PromotionTargetDto[],
  ) {
    for (const target of targets) {
      if (
        !target.productId &&
        !target.categoryId &&
        !target.priceListId &&
        !target.businessAccountId &&
        !target.minimumQuantity
      ) {
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

  private validatePromotion(body: PromotionDto) {
    this.validateDates(body.startsAt, body.endsAt);
    if (body.benefitType === 'PERCENTAGE' && body.benefitValue > 100) {
      throw new BadRequestException('A percentagem deve estar entre 0 e 100.');
    }
  }

  private validateDates(from?: string, until?: string) {
    const start = from ? new Date(from) : null;
    const end = until ? new Date(until) : null;
    if (
      (start && Number.isNaN(start.getTime())) ||
      (end && Number.isNaN(end.getTime()))
    ) {
      throw new BadRequestException('Data inválida.');
    }
    if (start && end && end <= start)
      throw new BadRequestException(
        'A data final tem de ser posterior à inicial.',
      );
  }

  private isUniqueViolation(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }
}
