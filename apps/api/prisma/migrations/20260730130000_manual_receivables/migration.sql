-- Sprint 10: manual payment agreements and auditable receivables follow-up.

CREATE TYPE "PaymentAgreementStatus" AS ENUM (
  'TO_AGREE',
  'AGREED',
  'AWAITING_PAYMENT',
  'PAID',
  'OVERDUE',
  'CANCELLED'
);

CREATE TYPE "PaymentContactType" AS ENUM (
  'CONTACT_ATTEMPT',
  'CONTACT_COMPLETED',
  'INSTRUCTIONS_SENT',
  'PAYMENT_PROMISE',
  'PROOF_RECEIVED',
  'PAYMENT_CONFIRMED',
  'OVERDUE',
  'CANCELLED'
);

CREATE TYPE "PaymentContactChannel" AS ENUM ('PHONE', 'EMAIL', 'WHATSAPP', 'IN_PERSON', 'OTHER');

CREATE TABLE "PaymentAgreement" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL,
  "status" "PaymentAgreementStatus" NOT NULL DEFAULT 'TO_AGREE',
  "method" TEXT,
  "expectedAmountCents" INTEGER NOT NULL,
  "dueAt" TIMESTAMP(3),
  "publicReference" TEXT,
  "internalReference" TEXT,
  "responsibleUserId" UUID,
  "internalNotes" TEXT,
  "agreedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAgreement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentAgreement_expectedAmountCents_check" CHECK ("expectedAmountCents" >= 0)
);

CREATE UNIQUE INDEX "PaymentAgreement_orderId_key" ON "PaymentAgreement"("orderId");
CREATE INDEX "PaymentAgreement_status_dueAt_idx" ON "PaymentAgreement"("status", "dueAt");
CREATE INDEX "PaymentAgreement_responsibleUserId_status_idx" ON "PaymentAgreement"("responsibleUserId", "status");

CREATE TABLE "PaymentContactEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "agreementId" UUID NOT NULL,
  "type" "PaymentContactType" NOT NULL,
  "channel" "PaymentContactChannel",
  "note" TEXT NOT NULL,
  "authorId" UUID,
  "nextContactAt" TIMESTAMP(3),
  "promisedPaymentAt" TIMESTAMP(3),
  "metadata" JSONB,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentContactEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentContactEvent_idempotencyKey_key"
  ON "PaymentContactEvent"("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX "PaymentContactEvent_agreementId_createdAt_idx"
  ON "PaymentContactEvent"("agreementId", "createdAt" DESC);
CREATE INDEX "PaymentContactEvent_nextContactAt_idx"
  ON "PaymentContactEvent"("nextContactAt")
  WHERE "nextContactAt" IS NOT NULL;

ALTER TABLE "PaymentAgreement"
  ADD CONSTRAINT "PaymentAgreement_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAgreement"
  ADD CONSTRAINT "PaymentAgreement_responsibleUserId_fkey"
  FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentContactEvent"
  ADD CONSTRAINT "PaymentContactEvent_agreementId_fkey"
  FOREIGN KEY ("agreementId") REFERENCES "PaymentAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentContactEvent"
  ADD CONSTRAINT "PaymentContactEvent_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
