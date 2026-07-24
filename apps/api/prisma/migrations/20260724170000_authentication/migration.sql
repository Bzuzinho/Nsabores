CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'STAFF', 'ADMIN');

CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "emailVerifiedAt" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "passwordResetTokenHash" TEXT,
  "passwordResetExpiresAt" TIMESTAMP(3),
  "emailVerificationTokenHash" TEXT,
  "emailVerificationExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerProfile" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "taxNumber" TEXT,
  "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
  "marketingConsentAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Address" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "label" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "company" TEXT,
  "taxNumber" TEXT,
  "line1" TEXT NOT NULL,
  "line2" TEXT,
  "postalCode" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "countryCode" CHAR(2) NOT NULL DEFAULT 'PT',
  "phone" TEXT,
  "isDefaultShipping" BOOLEAN NOT NULL DEFAULT false,
  "isDefaultBilling" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_passwordResetTokenHash_key" ON "User"("passwordResetTokenHash");
CREATE UNIQUE INDEX "User_emailVerificationTokenHash_key" ON "User"("emailVerificationTokenHash");
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");
CREATE UNIQUE INDEX "CustomerProfile_userId_key" ON "CustomerProfile"("userId");
CREATE INDEX "Address_userId_idx" ON "Address"("userId");
CREATE UNIQUE INDEX "AuthSession_refreshTokenHash_key" ON "AuthSession"("refreshTokenHash");
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
