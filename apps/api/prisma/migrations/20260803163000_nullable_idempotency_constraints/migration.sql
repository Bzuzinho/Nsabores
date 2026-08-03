-- Align nullable @unique fields with Prisma upsert semantics.
-- PostgreSQL allows multiple NULL values in a regular unique index.

DROP INDEX IF EXISTS "PaymentContactEvent_idempotencyKey_key";
CREATE UNIQUE INDEX "PaymentContactEvent_idempotencyKey_key"
  ON "PaymentContactEvent"("idempotencyKey");

DROP INDEX IF EXISTS "FiscalDocument_idempotencyKey_key";
CREATE UNIQUE INDEX "FiscalDocument_idempotencyKey_key"
  ON "FiscalDocument"("idempotencyKey");
