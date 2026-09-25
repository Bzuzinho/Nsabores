CREATE TABLE "OrderDocument" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "label" TEXT NOT NULL,
    "reference" TEXT,
    "documentDate" TIMESTAMP(3),
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderDocument_orderId_createdAt_idx"
ON "OrderDocument"("orderId", "createdAt");

ALTER TABLE "OrderDocument"
ADD CONSTRAINT "OrderDocument_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderDocument"
ADD CONSTRAINT "OrderDocument_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
