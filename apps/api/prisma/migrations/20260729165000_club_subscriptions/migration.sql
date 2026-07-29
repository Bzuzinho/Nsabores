-- Sprint 8: Clube Nsabores plans, recurring subscriptions, events and charges.

CREATE TYPE "ClubPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "ClubBillingInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');
CREATE TYPE "ClubSubscriptionStatus" AS ENUM (
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'PAUSED',
  'CANCEL_AT_PERIOD_END',
  'CANCELLED',
  'EXPIRED'
);
CREATE TYPE "ClubSubscriptionEventType" AS ENUM (
  'CREATED',
  'TRIAL_STARTED',
  'ACTIVATED',
  'RENEWED',
  'PAYMENT_FAILED',
  'PLAN_CHANGED',
  'CANCEL_SCHEDULED',
  'CANCELLED',
  'RESUMED',
  'PAUSED',
  'EXPIRED'
);
CREATE TYPE "ClubChargeStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');

CREATE TABLE "ClubPlan" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "status" "ClubPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "priceCents" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
  "billingInterval" "ClubBillingInterval" NOT NULL,
  "trialDays" INTEGER,
  "benefits" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClubPlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClubPlan_priceCents_check" CHECK ("priceCents" >= 0),
  CONSTRAINT "ClubPlan_trialDays_check" CHECK ("trialDays" IS NULL OR "trialDays" >= 0)
);

CREATE UNIQUE INDEX "ClubPlan_code_key" ON "ClubPlan"("code");
CREATE INDEX "ClubPlan_status_isPublic_sortOrder_idx" ON "ClubPlan"("status", "isPublic", "sortOrder");

CREATE TABLE "ClubSubscription" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "planId" UUID NOT NULL,
  "status" "ClubSubscriptionStatus" NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "providerCustomerId" TEXT,
  "providerSubscriptionId" TEXT,
  "currentPeriodStart" TIMESTAMP(3) NOT NULL,
  "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
  "trialEndsAt" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "cancelledAt" TIMESTAMP(3),
  "priceCentsSnapshot" INTEGER NOT NULL,
  "currencySnapshot" CHAR(3) NOT NULL DEFAULT 'EUR',
  "billingIntervalSnapshot" "ClubBillingInterval" NOT NULL,
  "planSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClubSubscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClubSubscription_priceCentsSnapshot_check" CHECK ("priceCentsSnapshot" >= 0),
  CONSTRAINT "ClubSubscription_period_check" CHECK ("currentPeriodEnd" > "currentPeriodStart")
);

CREATE UNIQUE INDEX "ClubSubscription_provider_providerSubscriptionId_key"
  ON "ClubSubscription"("provider", "providerSubscriptionId")
  WHERE "providerSubscriptionId" IS NOT NULL;
CREATE INDEX "ClubSubscription_userId_createdAt_idx" ON "ClubSubscription"("userId", "createdAt" DESC);
CREATE INDEX "ClubSubscription_status_currentPeriodEnd_idx" ON "ClubSubscription"("status", "currentPeriodEnd");
CREATE UNIQUE INDEX "ClubSubscription_user_active_key"
  ON "ClubSubscription"("userId")
  WHERE "status" IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCEL_AT_PERIOD_END');

CREATE TABLE "ClubSubscriptionEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "subscriptionId" UUID NOT NULL,
  "type" "ClubSubscriptionEventType" NOT NULL,
  "fromStatus" "ClubSubscriptionStatus",
  "toStatus" "ClubSubscriptionStatus",
  "providerEventId" TEXT,
  "authorId" UUID,
  "note" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClubSubscriptionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubSubscriptionEvent_providerEventId_key"
  ON "ClubSubscriptionEvent"("providerEventId")
  WHERE "providerEventId" IS NOT NULL;
CREATE INDEX "ClubSubscriptionEvent_subscriptionId_createdAt_idx"
  ON "ClubSubscriptionEvent"("subscriptionId", "createdAt");

CREATE TABLE "ClubSubscriptionCharge" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "subscriptionId" UUID NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
  "status" "ClubChargeStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "providerPaymentId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "paidAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClubSubscriptionCharge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClubSubscriptionCharge_amountCents_check" CHECK ("amountCents" >= 0),
  CONSTRAINT "ClubSubscriptionCharge_period_check" CHECK ("periodEnd" > "periodStart")
);

CREATE UNIQUE INDEX "ClubSubscriptionCharge_idempotencyKey_key" ON "ClubSubscriptionCharge"("idempotencyKey");
CREATE UNIQUE INDEX "ClubSubscriptionCharge_provider_providerPaymentId_key"
  ON "ClubSubscriptionCharge"("provider", "providerPaymentId")
  WHERE "providerPaymentId" IS NOT NULL;
CREATE INDEX "ClubSubscriptionCharge_subscriptionId_periodStart_idx"
  ON "ClubSubscriptionCharge"("subscriptionId", "periodStart" DESC);
CREATE INDEX "ClubSubscriptionCharge_status_createdAt_idx"
  ON "ClubSubscriptionCharge"("status", "createdAt");

ALTER TABLE "ClubSubscription"
  ADD CONSTRAINT "ClubSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClubSubscription"
  ADD CONSTRAINT "ClubSubscription_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "ClubPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClubSubscriptionEvent"
  ADD CONSTRAINT "ClubSubscriptionEvent_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "ClubSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubSubscriptionEvent"
  ADD CONSTRAINT "ClubSubscriptionEvent_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClubSubscriptionCharge"
  ADD CONSTRAINT "ClubSubscriptionCharge_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "ClubSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
