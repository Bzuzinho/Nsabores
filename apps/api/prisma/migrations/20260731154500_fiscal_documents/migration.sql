-- Sprint 11: commercial and fiscal document persistence.

CREATE TYPE "FiscalDocumentType" AS ENUM (
  'INVOICE',
  'INVOICE_RECEIPT',
  'RECEIPT',
  'CREDIT_NOTE',
  'PROFORMA'
);

CREATE TYPE "FiscalDocumentStatus" AS ENUM (
  'DRAFT',
  'ISSUED',
  'CANCELLED',
  'CREDITED',
  'FAILED'
);

CREATE TYPE "FiscalSourceType" AS ENUM (
  'ORDER',
  'GIFT_CARD_PURCHASE',
  'CLUB_CHARGE',
  'MANUAL'
);

CREATE TYPE "FiscalEventType" AS ENUM (
  'CREATED',
  'ISSUED',
  'PROVIDER_FAILED',
  'REPROCESSED',
  'CANCELLED',
  'CREDITED'
);

CREATE TABLE "FiscalSeries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "documentType" "FiscalDocumentType" NOT NULL,
  "prefix" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "nextNumber" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalSeries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FiscalSeries_year_check" CHECK ("year" >= 2000),
  CONSTRAINT "FiscalSeries_nextNumber_check" CHECK ("nextNumber" >= 1)
);

CREATE UNIQUE INDEX "FiscalSeries_code_documentType_year_key"
  ON "FiscalSeries"("code", "documentType", "year");
CREATE INDEX "FiscalSeries_documentType_isActive_year_idx"
  ON "FiscalSeries"("documentType", "isActive", "year");

CREATE TABLE "FiscalDocument" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "seriesId" UUID NOT NULL,
  "type" "FiscalDocumentType" NOT NULL,
  "status" "FiscalDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceType" "FiscalSourceType" NOT NULL,
  "sourceId" UUID,
  "customerUserId" UUID,
  "parentDocumentId" UUID,
  "sequentialNumber" INTEGER,
  "number" TEXT,
  "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
  "subtotalCents" INTEGER NOT NULL,
  "discountCents" INTEGER NOT NULL DEFAULT 0,
  "taxCents" INTEGER NOT NULL DEFAULT 0,
  "totalCents" INTEGER NOT NULL,
  "customerSnapshot" JSONB NOT NULL,
  "billingSnapshot" JSONB NOT NULL,
  "metadata" JSONB,
  "externalNumber" TEXT,
  "externalDocumentUrl" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'manual',
  "providerReference" TEXT,
  "providerError" TEXT,
  "issuedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FiscalDocument_subtotal_check" CHECK ("subtotalCents" >= 0),
  CONSTRAINT "FiscalDocument_discount_check" CHECK ("discountCents" >= 0),
  CONSTRAINT "FiscalDocument_tax_check" CHECK ("taxCents" >= 0),
  CONSTRAINT "FiscalDocument_total_check" CHECK ("totalCents" >= 0),
  CONSTRAINT "FiscalDocument_sequence_check" CHECK ("sequentialNumber" IS NULL OR "sequentialNumber" >= 1),
  CONSTRAINT "FiscalDocument_source_check" CHECK (
    ("sourceType" = 'MANUAL' AND "sourceId" IS NULL)
    OR ("sourceType" <> 'MANUAL' AND "sourceId" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "FiscalDocument_seriesId_sequentialNumber_key"
  ON "FiscalDocument"("seriesId", "sequentialNumber")
  WHERE "sequentialNumber" IS NOT NULL;
CREATE UNIQUE INDEX "FiscalDocument_sourceType_sourceId_type_key"
  ON "FiscalDocument"("sourceType", "sourceId", "type")
  WHERE "sourceId" IS NOT NULL;
CREATE INDEX "FiscalDocument_status_createdAt_idx"
  ON "FiscalDocument"("status", "createdAt");
CREATE INDEX "FiscalDocument_customerUserId_issuedAt_idx"
  ON "FiscalDocument"("customerUserId", "issuedAt");
CREATE INDEX "FiscalDocument_sourceType_sourceId_idx"
  ON "FiscalDocument"("sourceType", "sourceId");
CREATE INDEX "FiscalDocument_parentDocumentId_idx"
  ON "FiscalDocument"("parentDocumentId");

CREATE TABLE "FiscalDocumentLine" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "documentId" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "sku" TEXT,
  "quantity" INTEGER NOT NULL,
  "unitPriceCents" INTEGER NOT NULL,
  "discountCents" INTEGER NOT NULL DEFAULT 0,
  "taxRateBasisPoints" INTEGER NOT NULL DEFAULT 0,
  "taxCents" INTEGER NOT NULL DEFAULT 0,
  "totalCents" INTEGER NOT NULL,
  "sourceLineId" UUID,
  "snapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalDocumentLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FiscalDocumentLine_position_check" CHECK ("position" >= 1),
  CONSTRAINT "FiscalDocumentLine_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "FiscalDocumentLine_unit_price_check" CHECK ("unitPriceCents" >= 0),
  CONSTRAINT "FiscalDocumentLine_discount_check" CHECK ("discountCents" >= 0),
  CONSTRAINT "FiscalDocumentLine_tax_rate_check" CHECK ("taxRateBasisPoints" >= 0),
  CONSTRAINT "FiscalDocumentLine_tax_check" CHECK ("taxCents" >= 0),
  CONSTRAINT "FiscalDocumentLine_total_check" CHECK ("totalCents" >= 0)
);

CREATE UNIQUE INDEX "FiscalDocumentLine_documentId_position_key"
  ON "FiscalDocumentLine"("documentId", "position");
CREATE INDEX "FiscalDocumentLine_documentId_idx"
  ON "FiscalDocumentLine"("documentId");

CREATE TABLE "FiscalDocumentEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "documentId" UUID NOT NULL,
  "type" "FiscalEventType" NOT NULL,
  "authorId" UUID,
  "note" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalDocumentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FiscalDocumentEvent_documentId_createdAt_idx"
  ON "FiscalDocumentEvent"("documentId", "createdAt");

ALTER TABLE "FiscalDocument"
  ADD CONSTRAINT "FiscalDocument_seriesId_fkey"
  FOREIGN KEY ("seriesId") REFERENCES "FiscalSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument"
  ADD CONSTRAINT "FiscalDocument_customerUserId_fkey"
  FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument"
  ADD CONSTRAINT "FiscalDocument_parentDocumentId_fkey"
  FOREIGN KEY ("parentDocumentId") REFERENCES "FiscalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument"
  ADD CONSTRAINT "FiscalDocument_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FiscalDocumentLine"
  ADD CONSTRAINT "FiscalDocumentLine_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "FiscalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalDocumentEvent"
  ADD CONSTRAINT "FiscalDocumentEvent_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "FiscalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalDocumentEvent"
  ADD CONSTRAINT "FiscalDocumentEvent_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
