-- Sprint 9: append-only loyalty points and gift-card monetary ledgers.

CREATE TYPE "LoyaltyAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "LoyaltyTransactionType" AS ENUM (
  'EARN_PENDING',
  'EARN_RELEASED',
  'REDEEM_RESERVED',
  'REDEEMED',
  'REDEEM_RELEASED',
  'EXPIRED',
  'REVERSED',
  'ADJUSTMENT'
);
CREATE TYPE "LoyaltyTransactionStatus" AS ENUM ('PENDING', 'AVAILABLE', 'RESERVED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "GiftCardStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'DEPLETED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "GiftCardTransactionType" AS ENUM ('ISSUE', 'RESERVE', 'REDEEM', 'RELEASE', 'REFUND', 'ADJUSTMENT', 'EXPIRE');
CREATE TYPE "GiftCardTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

CREATE TABLE "LoyaltyAccount" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "status" "LoyaltyAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "availablePoints" INTEGER NOT NULL DEFAULT 0,
  "pendingPoints" INTEGER NOT NULL DEFAULT 0,
  "reservedPoints" INTEGER NOT NULL DEFAULT 0,
  "lifetimeEarnedPoints" INTEGER NOT NULL DEFAULT 0,
  "lifetimeRedeemedPoints" INTEGER NOT NULL DEFAULT 0,
  "tier" TEXT,
  "suspendedAt" TIMESTAMP(3),
  "suspensionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LoyaltyAccount_balances_check" CHECK (
    "availablePoints" >= 0 AND "pendingPoints" >= 0 AND "reservedPoints" >= 0
  ),
  CONSTRAINT "LoyaltyAccount_lifetime_check" CHECK (
    "lifetimeEarnedPoints" >= 0 AND "lifetimeRedeemedPoints" >= 0
  )
);

CREATE UNIQUE INDEX "LoyaltyAccount_userId_key" ON "LoyaltyAccount"("userId");
CREATE INDEX "LoyaltyAccount_status_updatedAt_idx" ON "LoyaltyAccount"("status", "updatedAt");

CREATE TABLE "LoyaltyRule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "channel" "SalesChannel",
  "pointsPerEuro" INTEGER NOT NULL DEFAULT 1,
  "clubMultiplierBasisPoints" INTEGER NOT NULL DEFAULT 10000,
  "minimumOrderCents" INTEGER,
  "maximumPointsPerOrder" INTEGER,
  "pendingDays" INTEGER NOT NULL DEFAULT 0,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "configuration" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LoyaltyRule_points_check" CHECK ("pointsPerEuro" >= 0),
  CONSTRAINT "LoyaltyRule_multiplier_check" CHECK ("clubMultiplierBasisPoints" >= 0),
  CONSTRAINT "LoyaltyRule_minimum_check" CHECK ("minimumOrderCents" IS NULL OR "minimumOrderCents" >= 0),
  CONSTRAINT "LoyaltyRule_maximum_check" CHECK ("maximumPointsPerOrder" IS NULL OR "maximumPointsPerOrder" >= 0),
  CONSTRAINT "LoyaltyRule_pending_check" CHECK ("pendingDays" >= 0)
);

CREATE UNIQUE INDEX "LoyaltyRule_code_key" ON "LoyaltyRule"("code");
CREATE INDEX "LoyaltyRule_isActive_channel_validFrom_validUntil_idx"
  ON "LoyaltyRule"("isActive", "channel", "validFrom", "validUntil");

CREATE TABLE "LoyaltyTransaction" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "accountId" UUID NOT NULL,
  "orderId" UUID,
  "ruleId" UUID,
  "type" "LoyaltyTransactionType" NOT NULL,
  "status" "LoyaltyTransactionStatus" NOT NULL,
  "points" INTEGER NOT NULL,
  "availableBalanceAfter" INTEGER NOT NULL,
  "pendingBalanceAfter" INTEGER NOT NULL,
  "reservedBalanceAfter" INTEGER NOT NULL,
  "availableAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "parentTransactionId" UUID,
  "idempotencyKey" TEXT NOT NULL,
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LoyaltyTransaction_points_check" CHECK ("points" <> 0),
  CONSTRAINT "LoyaltyTransaction_balances_check" CHECK (
    "availableBalanceAfter" >= 0 AND "pendingBalanceAfter" >= 0 AND "reservedBalanceAfter" >= 0
  )
);

CREATE UNIQUE INDEX "LoyaltyTransaction_idempotencyKey_key" ON "LoyaltyTransaction"("idempotencyKey");
CREATE INDEX "LoyaltyTransaction_accountId_createdAt_idx" ON "LoyaltyTransaction"("accountId", "createdAt" DESC);
CREATE INDEX "LoyaltyTransaction_status_availableAt_idx" ON "LoyaltyTransaction"("status", "availableAt");
CREATE INDEX "LoyaltyTransaction_orderId_idx" ON "LoyaltyTransaction"("orderId");

CREATE TABLE "GiftCard" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "codeHash" TEXT NOT NULL,
  "codeLast4" CHAR(4) NOT NULL,
  "pinHash" TEXT,
  "status" "GiftCardStatus" NOT NULL DEFAULT 'ACTIVE',
  "initialAmountCents" INTEGER NOT NULL,
  "balanceCents" INTEGER NOT NULL,
  "reservedCents" INTEGER NOT NULL DEFAULT 0,
  "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
  "purchaserUserId" UUID,
  "recipientEmail" TEXT,
  "recipientName" TEXT,
  "message" TEXT,
  "expiresAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "blockedAt" TIMESTAMP(3),
  "blockReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GiftCard_amount_check" CHECK (
    "initialAmountCents" >= 0 AND "balanceCents" >= 0 AND "reservedCents" >= 0
  ),
  CONSTRAINT "GiftCard_balance_limit_check" CHECK ("balanceCents" + "reservedCents" <= "initialAmountCents")
);

CREATE UNIQUE INDEX "GiftCard_codeHash_key" ON "GiftCard"("codeHash");
CREATE INDEX "GiftCard_status_expiresAt_idx" ON "GiftCard"("status", "expiresAt");
CREATE INDEX "GiftCard_purchaserUserId_createdAt_idx" ON "GiftCard"("purchaserUserId", "createdAt" DESC);

CREATE TABLE "GiftCardTransaction" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "giftCardId" UUID NOT NULL,
  "orderId" UUID,
  "type" "GiftCardTransactionType" NOT NULL,
  "status" "GiftCardTransactionStatus" NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "balanceAfterCents" INTEGER NOT NULL,
  "reservedAfterCents" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "parentTransactionId" UUID,
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiftCardTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GiftCardTransaction_amount_check" CHECK ("amountCents" <> 0),
  CONSTRAINT "GiftCardTransaction_balances_check" CHECK (
    "balanceAfterCents" >= 0 AND "reservedAfterCents" >= 0
  )
);

CREATE UNIQUE INDEX "GiftCardTransaction_idempotencyKey_key" ON "GiftCardTransaction"("idempotencyKey");
CREATE INDEX "GiftCardTransaction_giftCardId_createdAt_idx"
  ON "GiftCardTransaction"("giftCardId", "createdAt" DESC);
CREATE INDEX "GiftCardTransaction_orderId_idx" ON "GiftCardTransaction"("orderId");

ALTER TABLE "LoyaltyAccount"
  ADD CONSTRAINT "LoyaltyAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyTransaction"
  ADD CONSTRAINT "LoyaltyTransaction_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoyaltyTransaction"
  ADD CONSTRAINT "LoyaltyTransaction_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LoyaltyTransaction"
  ADD CONSTRAINT "LoyaltyTransaction_ruleId_fkey"
  FOREIGN KEY ("ruleId") REFERENCES "LoyaltyRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LoyaltyTransaction"
  ADD CONSTRAINT "LoyaltyTransaction_parentTransactionId_fkey"
  FOREIGN KEY ("parentTransactionId") REFERENCES "LoyaltyTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GiftCard"
  ADD CONSTRAINT "GiftCard_purchaserUserId_fkey"
  FOREIGN KEY ("purchaserUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GiftCardTransaction"
  ADD CONSTRAINT "GiftCardTransaction_giftCardId_fkey"
  FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GiftCardTransaction"
  ADD CONSTRAINT "GiftCardTransaction_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GiftCardTransaction"
  ADD CONSTRAINT "GiftCardTransaction_parentTransactionId_fkey"
  FOREIGN KEY ("parentTransactionId") REFERENCES "GiftCardTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
