-- Sprint 7: promotions, coupons and immutable order discount snapshots

CREATE TYPE "PromotionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED');
CREATE TYPE "PromotionBenefitType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'SPECIAL_PRICE', 'QUANTITY_DEAL');
CREATE TYPE "PromotionChannel" AS ENUM ('B2C', 'B2B', 'BOTH');

CREATE TABLE "Promotion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "status" "PromotionStatus" NOT NULL DEFAULT 'DRAFT',
  "benefitType" "PromotionBenefitType" NOT NULL,
  "benefitValue" INTEGER NOT NULL DEFAULT 0,
  "channel" "PromotionChannel" NOT NULL DEFAULT 'BOTH',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "priority" INTEGER NOT NULL DEFAULT 0,
  "stackable" BOOLEAN NOT NULL DEFAULT false,
  "globalUsageLimit" INTEGER,
  "perCustomerLimit" INTEGER,
  "minimumCartCents" INTEGER,
  "maximumDiscountCents" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Promotion_benefitValue_check" CHECK ("benefitValue" >= 0),
  CONSTRAINT "Promotion_globalUsageLimit_check" CHECK ("globalUsageLimit" IS NULL OR "globalUsageLimit" > 0),
  CONSTRAINT "Promotion_perCustomerLimit_check" CHECK ("perCustomerLimit" IS NULL OR "perCustomerLimit" > 0),
  CONSTRAINT "Promotion_minimumCartCents_check" CHECK ("minimumCartCents" IS NULL OR "minimumCartCents" >= 0),
  CONSTRAINT "Promotion_maximumDiscountCents_check" CHECK ("maximumDiscountCents" IS NULL OR "maximumDiscountCents" >= 0)
);

CREATE TABLE "PromotionTarget" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "promotionId" UUID NOT NULL,
  "productId" UUID,
  "categoryId" UUID,
  "priceListId" UUID,
  "businessAccountId" UUID,
  "minimumQuantity" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromotionTarget_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PromotionTarget_minimumQuantity_check" CHECK ("minimumQuantity" IS NULL OR "minimumQuantity" > 0),
  CONSTRAINT "PromotionTarget_scope_check" CHECK (
    "productId" IS NOT NULL OR "categoryId" IS NOT NULL OR "priceListId" IS NOT NULL OR "businessAccountId" IS NOT NULL OR "minimumQuantity" IS NOT NULL
  )
);

CREATE TABLE "Coupon" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "promotionId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "usageLimit" INTEGER,
  "perUserLimit" INTEGER,
  "channel" "PromotionChannel" NOT NULL DEFAULT 'BOTH',
  "minimumCartCents" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Coupon_usageLimit_check" CHECK ("usageLimit" IS NULL OR "usageLimit" > 0),
  CONSTRAINT "Coupon_perUserLimit_check" CHECK ("perUserLimit" IS NULL OR "perUserLimit" > 0),
  CONSTRAINT "Coupon_minimumCartCents_check" CHECK ("minimumCartCents" IS NULL OR "minimumCartCents" >= 0)
);

CREATE TABLE "CouponRedemption" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "couponId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "userId" UUID,
  "businessAccountId" UUID,
  "amountCents" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CouponRedemption_amount_check" CHECK ("amountCents" >= 0)
);

CREATE TABLE "CartPromotion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cartId" UUID NOT NULL,
  "promotionId" UUID NOT NULL,
  "couponId" UUID,
  "code" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CartPromotion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderDiscount" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL,
  "promotionId" UUID,
  "couponId" UUID,
  "source" TEXT NOT NULL,
  "code" TEXT,
  "label" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderDiscount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderDiscount_amount_check" CHECK ("amountCents" >= 0)
);

CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");
CREATE INDEX "Promotion_status_channel_priority_idx" ON "Promotion"("status", "channel", "priority");
CREATE INDEX "Promotion_dates_idx" ON "Promotion"("startsAt", "endsAt");
CREATE INDEX "PromotionTarget_promotionId_idx" ON "PromotionTarget"("promotionId");
CREATE INDEX "PromotionTarget_productId_idx" ON "PromotionTarget"("productId");
CREATE INDEX "PromotionTarget_categoryId_idx" ON "PromotionTarget"("categoryId");
CREATE INDEX "PromotionTarget_priceListId_idx" ON "PromotionTarget"("priceListId");
CREATE INDEX "PromotionTarget_businessAccountId_idx" ON "PromotionTarget"("businessAccountId");
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX "Coupon_promotionId_isActive_idx" ON "Coupon"("promotionId", "isActive");
CREATE UNIQUE INDEX "CouponRedemption_idempotencyKey_key" ON "CouponRedemption"("idempotencyKey");
CREATE INDEX "CouponRedemption_couponId_redeemedAt_idx" ON "CouponRedemption"("couponId", "redeemedAt");
CREATE INDEX "CouponRedemption_userId_couponId_idx" ON "CouponRedemption"("userId", "couponId");
CREATE INDEX "CouponRedemption_businessAccountId_couponId_idx" ON "CouponRedemption"("businessAccountId", "couponId");
CREATE UNIQUE INDEX "CartPromotion_cartId_key" ON "CartPromotion"("cartId");
CREATE INDEX "OrderDiscount_orderId_idx" ON "OrderDiscount"("orderId");

ALTER TABLE "PromotionTarget" ADD CONSTRAINT "PromotionTarget_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionTarget" ADD CONSTRAINT "PromotionTarget_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionTarget" ADD CONSTRAINT "PromotionTarget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionTarget" ADD CONSTRAINT "PromotionTarget_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionTarget" ADD CONSTRAINT "PromotionTarget_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CartPromotion" ADD CONSTRAINT "CartPromotion_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartPromotion" ADD CONSTRAINT "CartPromotion_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartPromotion" ADD CONSTRAINT "CartPromotion_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderDiscount" ADD CONSTRAINT "OrderDiscount_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderDiscount" ADD CONSTRAINT "OrderDiscount_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderDiscount" ADD CONSTRAINT "OrderDiscount_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
