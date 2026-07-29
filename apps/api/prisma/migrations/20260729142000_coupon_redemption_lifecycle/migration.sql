-- Sprint 7: consume coupon usage only after payment confirmation and release it on cancellation.

CREATE OR REPLACE FUNCTION "nsabores_record_coupon_redemption"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."status" = 'PAID'::"PaymentStatus"
     AND OLD."status" IS DISTINCT FROM NEW."status" THEN
    INSERT INTO "CouponRedemption" (
      "id", "couponId", "orderId", "userId", "businessAccountId",
      "amountCents", "idempotencyKey", "redeemedAt"
    )
    SELECT
      gen_random_uuid(),
      od."couponId",
      o."id",
      o."userId",
      o."businessAccountId",
      od."amountCents",
      'coupon:' || od."couponId"::text || ':order:' || o."id"::text,
      CURRENT_TIMESTAMP
    FROM "OrderDiscount" od
    JOIN "Order" o ON o."id" = od."orderId"
    WHERE od."orderId" = NEW."orderId"
      AND od."couponId" IS NOT NULL
    ON CONFLICT ("idempotencyKey") DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Payment_coupon_redemption_trigger" ON "Payment";
CREATE TRIGGER "Payment_coupon_redemption_trigger"
AFTER UPDATE OF "status" ON "Payment"
FOR EACH ROW
EXECUTE FUNCTION "nsabores_record_coupon_redemption"();

CREATE OR REPLACE FUNCTION "nsabores_release_coupon_redemption"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."status" = 'CANCELLED'::"OrderStatus"
     AND OLD."status" IS DISTINCT FROM NEW."status" THEN
    DELETE FROM "CouponRedemption" WHERE "orderId" = NEW."id";
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Order_coupon_release_trigger" ON "Order";
CREATE TRIGGER "Order_coupon_release_trigger"
AFTER UPDATE OF "status" ON "Order"
FOR EACH ROW
EXECUTE FUNCTION "nsabores_release_coupon_redemption"();
