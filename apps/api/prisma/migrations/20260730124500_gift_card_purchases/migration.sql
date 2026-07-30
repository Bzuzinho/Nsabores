CREATE TYPE "GiftCardPurchaseStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'CANCELLED');

CREATE TABLE "GiftCardPurchase" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "purchaserUserId" UUID,
  "purchaserEmail" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "recipientName" TEXT,
  "message" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
  "status" "GiftCardPurchaseStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "providerPaymentId" TEXT,
  "giftCardId" UUID,
  "idempotencyKey" TEXT NOT NULL,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiftCardPurchase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GiftCardPurchase_amount_check" CHECK ("amountCents" >= 100)
);

CREATE UNIQUE INDEX "GiftCardPurchase_idempotencyKey_key" ON "GiftCardPurchase"("idempotencyKey");
CREATE UNIQUE INDEX "GiftCardPurchase_provider_providerPaymentId_key"
  ON "GiftCardPurchase"("provider", "providerPaymentId")
  WHERE "providerPaymentId" IS NOT NULL;
CREATE UNIQUE INDEX "GiftCardPurchase_giftCardId_key" ON "GiftCardPurchase"("giftCardId") WHERE "giftCardId" IS NOT NULL;
CREATE INDEX "GiftCardPurchase_status_createdAt_idx" ON "GiftCardPurchase"("status", "createdAt");

ALTER TABLE "GiftCardPurchase"
  ADD CONSTRAINT "GiftCardPurchase_purchaserUserId_fkey"
  FOREIGN KEY ("purchaserUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GiftCardPurchase"
  ADD CONSTRAINT "GiftCardPurchase_giftCardId_fkey"
  FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
