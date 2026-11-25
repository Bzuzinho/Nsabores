-- Additive V2 foundation; no backfill or live switch.
BEGIN;
CREATE TYPE "PartyKind" AS ENUM ('PERSON', 'ORGANIZATION');
CREATE TYPE "PartyProfileKind" AS ENUM ('CLIENT', 'RESELLER');
CREATE TYPE "PartyResellerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "InternalRoleKind" AS ENUM ('STAFF', 'ADMIN');
CREATE TABLE "Party" (
 "id" UUID NOT NULL PRIMARY KEY,
 "kind" "PartyKind" NOT NULL,
 "displayName" TEXT NOT NULL,
 "taxNumber" TEXT,
 "contactEmail" TEXT,
 "phone" TEXT,
 "isActive" BOOLEAN NOT NULL DEFAULT true,
 "userId" UUID UNIQUE REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "legacyCustomerId" UUID UNIQUE REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "legacyBusinessId" UUID UNIQUE REFERENCES "BusinessAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Party_person_credentials_check" CHECK ("userId" IS NULL OR "kind" = 'PERSON')
);
CREATE INDEX "Party_kind_isActive_idx" ON "Party"("kind", "isActive");
CREATE INDEX "Party_taxNumber_idx" ON "Party"("taxNumber");
CREATE TABLE "PartyProfile" (
 "partyId" UUID NOT NULL REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "kind" "PartyProfileKind" NOT NULL,
 "resellerStatus" "PartyResellerStatus",
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("partyId", "kind"),
 CONSTRAINT "PartyProfile_reseller_status_check" CHECK (("kind" = 'RESELLER' AND "resellerStatus" IS NOT NULL) OR ("kind" = 'CLIENT' AND "resellerStatus" IS NULL))
);
CREATE TABLE "PartyMembership" (
 "partyId" UUID NOT NULL REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "isActive" BOOLEAN NOT NULL DEFAULT false,
 "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 PRIMARY KEY ("partyId", "userId")
);
CREATE INDEX "PartyMembership_userId_isActive_idx" ON "PartyMembership"("userId", "isActive");
CREATE TABLE "InternalRoleAssignment" (
 "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "role" "InternalRoleKind" NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("userId", "role")
);
CREATE TABLE "PartyCommercialTerms" (
 "partyId" UUID NOT NULL PRIMARY KEY REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "priceListId" UUID REFERENCES "PriceList"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "resellerLevel" INTEGER,
 "paymentDays" INTEGER NOT NULL DEFAULT 0,
 "creditLimitCents" INTEGER,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "PartyCommercialTerms_reseller_level_check" CHECK ("resellerLevel" IS NULL OR "resellerLevel" BETWEEN 1 AND 3),
 CONSTRAINT "PartyCommercialTerms_nonnegative_check" CHECK ("paymentDays" >= 0 AND ("creditLimitCents" IS NULL OR "creditLimitCents" >= 0))
);
COMMIT;
