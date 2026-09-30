CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'COMPANY');

CREATE TABLE "Customer" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID,
  "type" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "company" TEXT,
  "taxNumber" TEXT,
  "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
  "marketingConsentAt" TIMESTAMP(3),
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");
CREATE INDEX "Customer_name_idx" ON "Customer"("name");
CREATE INDEX "Customer_isActive_deletedAt_idx" ON "Customer"("isActive", "deletedAt");

ALTER TABLE "Customer"
ADD CONSTRAINT "Customer_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Address" ADD COLUMN "customerId" UUID;
ALTER TABLE "Address" ALTER COLUMN "userId" DROP NOT NULL;

CREATE INDEX "Address_customerId_idx" ON "Address"("customerId");

ALTER TABLE "Address"
ADD CONSTRAINT "Address_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "customerId" UUID;
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");

ALTER TABLE "Order"
ADD CONSTRAINT "Order_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Customer" (
  "id", "userId", "type", "name", "email", "phone", "taxNumber",
  "marketingConsent", "marketingConsentAt", "notes", "isActive",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  u."id",
  'INDIVIDUAL'::"CustomerType",
  trim(concat(u."firstName", ' ', u."lastName")),
  lower(u."email"),
  u."phone",
  cp."taxNumber",
  COALESCE(cp."marketingConsent", false),
  cp."marketingConsentAt",
  cp."notes",
  u."isActive",
  u."createdAt",
  CURRENT_TIMESTAMP
FROM "User" u
LEFT JOIN "CustomerProfile" cp ON cp."userId" = u."id"
WHERE u."role" = 'CUSTOMER'::"UserRole"
  AND u."deletedAt" IS NULL
ON CONFLICT ("email") DO NOTHING;

INSERT INTO "Customer" (
  "id", "type", "name", "email", "phone", "isActive", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  'INDIVIDUAL'::"CustomerType",
  source."customerName",
  source."email",
  source."phone",
  true,
  source."createdAt",
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (lower(o."email"))
    o."customerName",
    lower(o."email") AS "email",
    o."phone",
    o."createdAt"
  FROM "Order" o
  WHERE o."email" IS NOT NULL
    AND o."email" <> ''
  ORDER BY lower(o."email"), o."createdAt" DESC
) source
WHERE NOT EXISTS (
  SELECT 1 FROM "Customer" c WHERE c."email" = source."email"
);

UPDATE "Address" a
SET "customerId" = c."id"
FROM "Customer" c
WHERE c."userId" = a."userId"
  AND a."customerId" IS NULL;

UPDATE "Order" o
SET "customerId" = c."id"
FROM "Customer" c
WHERE c."userId" = o."userId"
  AND o."customerId" IS NULL;

UPDATE "Order" o
SET "customerId" = c."id"
FROM "Customer" c
WHERE c."email" = lower(o."email")
  AND o."customerId" IS NULL;
