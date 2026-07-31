-- Sprint 11: idempotent credit notes and repeated partial credits.
ALTER TABLE "FiscalDocument"
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "FiscalDocument_idempotencyKey_key"
  ON "FiscalDocument"("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;
