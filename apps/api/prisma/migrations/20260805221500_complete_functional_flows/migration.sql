ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'DRAFT' BEFORE 'PENDING_PAYMENT';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL' BEFORE 'PENDING_PAYMENT';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REJECTED' AFTER 'CANCELLED';

CREATE TABLE "NewsletterSubscription" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'WEBSITE',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsletterSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NewsletterSubscription_email_key" ON "NewsletterSubscription"("email");
CREATE INDEX "NewsletterSubscription_isActive_createdAt_idx" ON "NewsletterSubscription"("isActive", "createdAt");
