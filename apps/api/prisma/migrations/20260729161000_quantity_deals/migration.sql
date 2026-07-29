-- Sprint 7: explicit buy-X-pay-Y quantity deal semantics.

ALTER TABLE "Promotion"
  ADD COLUMN "quantityBuy" INTEGER,
  ADD COLUMN "quantityPay" INTEGER;

ALTER TABLE "Promotion"
  ADD CONSTRAINT "Promotion_quantity_buy_check"
    CHECK ("quantityBuy" IS NULL OR "quantityBuy" >= 2),
  ADD CONSTRAINT "Promotion_quantity_pay_check"
    CHECK ("quantityPay" IS NULL OR "quantityPay" >= 1),
  ADD CONSTRAINT "Promotion_quantity_range_check"
    CHECK (
      ("quantityBuy" IS NULL AND "quantityPay" IS NULL)
      OR
      ("quantityBuy" IS NOT NULL AND "quantityPay" IS NOT NULL AND "quantityPay" < "quantityBuy")
    ),
  ADD CONSTRAINT "Promotion_quantity_type_check"
    CHECK (
      "benefitType" = 'QUANTITY_DEAL'::"PromotionBenefitType"
      OR ("quantityBuy" IS NULL AND "quantityPay" IS NULL)
    );
