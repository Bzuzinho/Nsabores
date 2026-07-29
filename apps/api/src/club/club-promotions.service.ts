import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AdvancedPromotionsService } from '../promotions/advanced-promotions.service';
import type {
  CartPricingResult,
  PricingDiscount,
} from '../promotions/promotions.service';
import { calculateClubPercentageDiscount } from './club-benefit';
import { isClubSchemaUnavailable } from './schema-compat';

type ActiveClubBenefit = {
  subscriptionId: string;
  planId: string;
  planCode: string;
  discountPercent: number;
};

@Injectable()
export class ClubPromotionsService extends AdvancedPromotionsService {
  constructor(private readonly clubPrisma: PrismaService) {
    super(clubPrisma);
  }

  override async priceCart(cartId: string, userId?: string, shippingCents = 0) {
    const base = await super.priceCart(cartId, userId, shippingCents);
    return this.applyClubBenefit(this.clubPrisma, base, userId);
  }

  override async priceCartInTransaction(
    tx: Prisma.TransactionClient,
    cartId: string,
    userId?: string,
    shippingCents = 0,
  ) {
    const base = await super.priceCartInTransaction(
      tx,
      cartId,
      userId,
      shippingCents,
    );
    return this.applyClubBenefit(tx, base, userId);
  }

  private async applyClubBenefit(
    client: Prisma.TransactionClient,
    base: CartPricingResult,
    userId?: string,
  ): Promise<CartPricingResult> {
    if (!userId || !base.items.length) return base;

    let benefits: ActiveClubBenefit[];
    try {
      benefits = await client.$queryRaw<ActiveClubBenefit[]>`
        SELECT
          s."id" AS "subscriptionId",
          s."planId",
          COALESCE(s."planSnapshot"->>'code', p."code") AS "planCode",
          COALESCE((s."planSnapshot"->'benefits'->>'discountPercent')::int, 0) AS "discountPercent"
        FROM "ClubSubscription" s
        JOIN "ClubPlan" p ON p."id" = s."planId"
        WHERE s."userId" = ${userId}::uuid
          AND s."status" IN ('TRIALING','ACTIVE','CANCEL_AT_PERIOD_END')
          AND s."currentPeriodEnd" > CURRENT_TIMESTAMP
        ORDER BY s."createdAt" DESC
        LIMIT 1
      `;
    } catch (error) {
      if (isClubSchemaUnavailable(error)) return base;
      throw error;
    }

    const benefit = benefits[0];
    if (!benefit || benefit.discountPercent <= 0) return base;

    const calculated = calculateClubPercentageDiscount(
      base.subtotalCents,
      base.productDiscountCents,
      benefit.discountPercent,
    );
    if (calculated.amountCents <= 0) return base;

    const line = {
      promotionId: null,
      couponId: null,
      source: 'CLUB',
      code: benefit.planCode,
      label: `Benefício Clube Nsabores · ${benefit.planCode}`,
      amountCents: calculated.amountCents,
      freeShipping: false,
      snapshot: {
        benefitType: 'CLUB_PERCENTAGE',
        discountPercent: calculated.percent,
        subscriptionId: benefit.subscriptionId,
        planId: benefit.planId,
        planCode: benefit.planCode,
        eligibleProductIds: base.items.map((item) => item.productId),
      },
    } as unknown as PricingDiscount;

    const productDiscountCents = Math.min(
      base.subtotalCents,
      base.productDiscountCents + calculated.amountCents,
    );
    const discountCents = Math.min(
      base.subtotalCents + base.shippingCents,
      productDiscountCents + base.shippingDiscountCents,
    );
    return {
      ...base,
      discounts: [...base.discounts, line],
      productDiscountCents,
      discountCents,
      totalCents: Math.max(
        0,
        base.subtotalCents + base.shippingCents - discountCents,
      ),
    };
  }
}
