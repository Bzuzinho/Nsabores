-- Sprint 7: allow the same product to exist in the cart with distinct bundle/personalization configurations.

ALTER TABLE "CartItem"
  ADD COLUMN "configurationKey" TEXT NOT NULL DEFAULT 'default';

DROP INDEX IF EXISTS "CartItem_cartId_productId_key";

CREATE UNIQUE INDEX "CartItem_cartId_productId_configurationKey_key"
  ON "CartItem"("cartId", "productId", "configurationKey");

CREATE INDEX "CartItem_cartId_configurationKey_idx"
  ON "CartItem"("cartId", "configurationKey");
