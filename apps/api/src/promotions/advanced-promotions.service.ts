import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  PromotionsService,
  type CartPricingResult,
  type PricingDiscount,
} from './promotions.service';
import type { QuantityDealDto } from './quantity-deal.dto';

type PricingClient = Prisma.TransactionClient;

type QuantityCandidate = {
  id: string;
  name: string;
  code: string;
  channel: 'B2C' | 'B2B' | 'BOTH';
  priority: number;
  stackable: boolean;
  globalUsageLimit: number | null;
  perCustomerLimit: number | null;
  maximumDiscountCents: number | null;
  quantityBuy: number;
  quantityPay: number;
  couponId: string | null;
  couponCode: string | null;
  source: 'AUTOMATIC' | 'COUPON';
  createdAt: Date;
};

type QuantityTarget = {
  productId: string | null;
  categoryId: string | null;
  priceListId: string | null;
  businessAccountId: string | null;
  minimumQuantity: number | null;
};

@Injectable()
export class AdvancedPromotionsService extends PromotionsService {
  constructor(private readonly advancedPrisma: PrismaService) {
    super(advancedPrisma);
  }

  async configureQuantityDeal(id: string, body: QuantityDealDto) {
    if (body.quantityPay >= body.quantityBuy) {
      throw new BadRequestException('A quantidade paga tem de ser inferior à quantidade levada.');
    }
    const rows = await this.advancedPrisma.$queryRaw<Array<{ benefitType: string }>>`
      SELECT "benefitType"::text AS "benefitType"
      FROM "Promotion"
      WHERE "id" = ${id}::uuid
      LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('Promoção não encontrada.');
    if (rows[0].benefitType !== 'QUANTITY_DEAL') {
      throw new BadRequestException('A promoção não é do tipo QUANTITY_DEAL.');
    }
    await this.advancedPrisma.$executeRaw`
      UPDATE "Promotion"
      SET "quantityBuy" = ${body.quantityBuy},
          "quantityPay" = ${body.quantityPay},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}::uuid
    `;
    return this.promotion(id);
  }

  override async priceCart(cartId: string, userId?: string, shippingCents = 0) {
    const base = await super.priceCart(cartId, userId, shippingCents);
    return this.applyQuantityDeals(
      this.advancedPrisma as unknown as PricingClient,
      cartId,
      userId,
      base,
    );
  }

  override async priceCartInTransaction(
    tx: Prisma.TransactionClient,
    cartId: string,
    userId?: string,
    shippingCents = 0,
  ) {
    const base = await super.priceCartInTransaction(tx, cartId, userId, shippingCents);
    return this.applyQuantityDeals(tx, cartId, userId, base);
  }

  private async applyQuantityDeals(
    client: PricingClient,
    cartId: string,
    userId: string | undefined,
    base: CartPricingResult,
  ): Promise<CartPricingResult> {
    if (!base.items.length) return base;
    const candidates = await this.quantityCandidates(client, cartId, base, userId);
    if (!candidates.length) return base;

    const categoryRows = await client.$queryRaw<Array<{ id: string; categoryId: string }>>(
      Prisma.sql`
        SELECT "id", "categoryId"
        FROM "Product"
        WHERE "id" IN (${Prisma.join(base.items.map((item) => Prisma.sql`${item.productId}::uuid`))})
      `,
    );
    const categoryByProduct = new Map(categoryRows.map((row) => [row.id, row.categoryId]));

    const discounts = [...base.discounts];
    let productDiscountCents = base.productDiscountCents;

    for (const candidate of candidates) {
      const targets = await client.$queryRaw<QuantityTarget[]>`
        SELECT "productId", "categoryId", "priceListId", "businessAccountId", "minimumQuantity"
        FROM "PromotionTarget"
        WHERE "promotionId" = ${candidate.id}::uuid
      `;
      const eligibleIds = new Set<string>();

      if (!targets.length) {
        for (const item of base.items) eligibleIds.add(item.id);
      } else {
        for (const target of targets) {
          if (target.priceListId && target.priceListId !== base.context.priceListId) continue;
          if (
            target.businessAccountId &&
            target.businessAccountId !== base.context.businessAccountId
          ) {
            continue;
          }
          const matched = base.items.filter(
            (item) =>
              (!target.productId || target.productId === item.productId) &&
              (!target.categoryId ||
                target.categoryId === categoryByProduct.get(item.productId)),
          );
          const matchedQuantity = matched.reduce((sum, item) => sum + item.quantity, 0);
          if (target.minimumQuantity && matchedQuantity < target.minimumQuantity) continue;
          for (const item of matched) eligibleIds.add(item.id);
        }
      }

      let amountCents = 0;
      const discountedUnits: Array<{ productId: string; units: number }> = [];
      for (const item of base.items) {
        if (!eligibleIds.has(item.id)) continue;
        const sets = Math.floor(item.quantity / candidate.quantityBuy);
        if (!sets) continue;
        const freeUnits = sets * (candidate.quantityBuy - candidate.quantityPay);
        amountCents += freeUnits * item.unitPriceCents;
        discountedUnits.push({ productId: item.productId, units: freeUnits });
      }
      if (candidate.maximumDiscountCents !== null) {
        amountCents = Math.min(amountCents, candidate.maximumDiscountCents);
      }
      amountCents = Math.min(
        amountCents,
        Math.max(0, base.subtotalCents - productDiscountCents),
      );
      if (amountCents <= 0) continue;

      const line: PricingDiscount = {
        promotionId: candidate.id,
        couponId: candidate.couponId,
        source: candidate.source,
        code: candidate.couponCode,
        label: candidate.name,
        amountCents,
        freeShipping: false,
        snapshot: {
          promotionCode: candidate.code,
          benefitType: 'QUANTITY_DEAL',
          quantityBuy: candidate.quantityBuy,
          quantityPay: candidate.quantityPay,
          channel: candidate.channel,
          priority: candidate.priority,
          stackable: candidate.stackable,
          discountedUnits,
        },
      };
      discounts.push(line);
      productDiscountCents += amountCents;
      if (!candidate.stackable) break;
    }

    const discountCents = Math.min(
      base.subtotalCents + base.shippingCents,
      productDiscountCents + base.shippingDiscountCents,
    );
    return {
      ...base,
      productDiscountCents,
      discountCents,
      totalCents: Math.max(0, base.subtotalCents + base.shippingCents - discountCents),
      discounts,
      coupon:
        discounts.find((discount) => discount.couponId !== null)?.couponId
          ? {
              id: discounts.find((discount) => discount.couponId !== null)!.couponId!,
              code: discounts.find((discount) => discount.couponId !== null)!.code ?? '',
            }
          : base.coupon,
    };
  }

  private async quantityCandidates(
    client: PricingClient,
    cartId: string,
    base: CartPricingResult,
    userId?: string,
  ) {
    const rows = await client.$queryRaw<QuantityCandidate[]>`
      SELECT p."id", p."name", p."code", p."channel"::text AS "channel", p."priority",
             p."stackable", p."globalUsageLimit", p."perCustomerLimit", p."maximumDiscountCents",
             p."quantityBuy", p."quantityPay", NULL::uuid AS "couponId", NULL::text AS "couponCode",
             'AUTOMATIC'::text AS "source", p."createdAt"
      FROM "Promotion" p
      WHERE p."status" = 'ACTIVE'::"PromotionStatus"
        AND p."benefitType" = 'QUANTITY_DEAL'::"PromotionBenefitType"
        AND p."quantityBuy" IS NOT NULL
        AND p."quantityPay" IS NOT NULL
        AND p."channel" IN (${base.context.channel}::"PromotionChannel", 'BOTH'::"PromotionChannel")
        AND (p."startsAt" IS NULL OR p."startsAt" <= CURRENT_TIMESTAMP)
        AND (p."endsAt" IS NULL OR p."endsAt" >= CURRENT_TIMESTAMP)
        AND (p."minimumCartCents" IS NULL OR p."minimumCartCents" <= ${base.subtotalCents})
        AND NOT EXISTS (SELECT 1 FROM "Coupon" c WHERE c."promotionId" = p."id")

      UNION ALL

      SELECT p."id", p."name", p."code", p."channel"::text AS "channel", p."priority",
             p."stackable", p."globalUsageLimit", p."perCustomerLimit", p."maximumDiscountCents",
             p."quantityBuy", p."quantityPay", c."id" AS "couponId", c."code" AS "couponCode",
             'COUPON'::text AS "source", p."createdAt"
      FROM "CartPromotion" cp
      JOIN "Coupon" c ON c."id" = cp."couponId"
      JOIN "Promotion" p ON p."id" = cp."promotionId"
      WHERE cp."cartId" = ${cartId}::uuid
        AND p."status" = 'ACTIVE'::"PromotionStatus"
        AND p."benefitType" = 'QUANTITY_DEAL'::"PromotionBenefitType"
        AND p."quantityBuy" IS NOT NULL
        AND p."quantityPay" IS NOT NULL
        AND c."isActive" = true
        AND p."channel" IN (${base.context.channel}::"PromotionChannel", 'BOTH'::"PromotionChannel")
        AND c."channel" IN (${base.context.channel}::"PromotionChannel", 'BOTH'::"PromotionChannel")
        AND (p."startsAt" IS NULL OR p."startsAt" <= CURRENT_TIMESTAMP)
        AND (p."endsAt" IS NULL OR p."endsAt" >= CURRENT_TIMESTAMP)
        AND (c."validFrom" IS NULL OR c."validFrom" <= CURRENT_TIMESTAMP)
        AND (c."validUntil" IS NULL OR c."validUntil" >= CURRENT_TIMESTAMP)
        AND (p."minimumCartCents" IS NULL OR p."minimumCartCents" <= ${base.subtotalCents})
        AND (c."minimumCartCents" IS NULL OR c."minimumCartCents" <= ${base.subtotalCents})
    `;

    const eligible: QuantityCandidate[] = [];
    for (const candidate of rows) {
      const counts = await client.$queryRaw<Array<{ globalCount: number; customerCount: number }>>`
        SELECT
          COUNT(*) FILTER (
            WHERE od."promotionId" = ${candidate.id}::uuid
              AND o."status" <> 'CANCELLED'::"OrderStatus"
          )::int AS "globalCount",
          COUNT(*) FILTER (
            WHERE od."promotionId" = ${candidate.id}::uuid
              AND o."status" <> 'CANCELLED'::"OrderStatus"
              AND (
                (${userId ?? null}::uuid IS NOT NULL AND o."userId" = ${userId ?? null}::uuid)
                OR (${base.context.businessAccountId}::uuid IS NOT NULL AND o."businessAccountId" = ${base.context.businessAccountId}::uuid)
              )
          )::int AS "customerCount"
        FROM "OrderDiscount" od
        JOIN "Order" o ON o."id" = od."orderId"
      `;
      if (
        candidate.globalUsageLimit !== null &&
        (counts[0]?.globalCount ?? 0) >= candidate.globalUsageLimit
      ) {
        continue;
      }
      if (
        candidate.perCustomerLimit !== null &&
        (counts[0]?.customerCount ?? 0) >= candidate.perCustomerLimit
      ) {
        continue;
      }
      eligible.push(candidate);
    }
    return eligible.sort(
      (a, b) => b.priority - a.priority || a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }
}
