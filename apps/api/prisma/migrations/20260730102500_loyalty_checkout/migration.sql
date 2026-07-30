CREATE TYPE "OrderBenefitStatus" AS ENUM ('RESERVED', 'CONSUMED', 'RELEASED', 'REFUNDED');

CREATE TABLE "OrderLoyaltyApplication" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "points" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "status" "OrderBenefitStatus" NOT NULL DEFAULT 'RESERVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderLoyaltyApplication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderLoyaltyApplication_points_check" CHECK ("points" > 0),
  CONSTRAINT "OrderLoyaltyApplication_amount_check" CHECK ("amountCents" > 0)
);

CREATE TABLE "OrderGiftCardApplication" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL,
  "giftCardId" UUID NOT NULL,
  "codeLast4" CHAR(4) NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "status" "OrderBenefitStatus" NOT NULL DEFAULT 'RESERVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderGiftCardApplication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderGiftCardApplication_amount_check" CHECK ("amountCents" > 0)
);

CREATE UNIQUE INDEX "OrderLoyaltyApplication_orderId_key" ON "OrderLoyaltyApplication"("orderId");
CREATE UNIQUE INDEX "OrderGiftCardApplication_orderId_key" ON "OrderGiftCardApplication"("orderId");
CREATE INDEX "OrderLoyaltyApplication_userId_status_idx" ON "OrderLoyaltyApplication"("userId", "status");
CREATE INDEX "OrderGiftCardApplication_giftCardId_status_idx" ON "OrderGiftCardApplication"("giftCardId", "status");

ALTER TABLE "OrderLoyaltyApplication"
  ADD CONSTRAINT "OrderLoyaltyApplication_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderLoyaltyApplication"
  ADD CONSTRAINT "OrderLoyaltyApplication_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderGiftCardApplication"
  ADD CONSTRAINT "OrderGiftCardApplication_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderGiftCardApplication"
  ADD CONSTRAINT "OrderGiftCardApplication_giftCardId_fkey"
  FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
