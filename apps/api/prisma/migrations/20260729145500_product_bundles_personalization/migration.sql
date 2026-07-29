-- Sprint 7: composite bundles and gift personalization.

CREATE TYPE "BundleMode" AS ENUM ('FIXED', 'CONFIGURABLE');
CREATE TYPE "BundlePricingMode" AS ENUM ('PRODUCT_PRICE', 'COMPONENT_TOTAL');

CREATE TABLE "ProductBundle" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productId" UUID NOT NULL,
  "mode" "BundleMode" NOT NULL DEFAULT 'FIXED',
  "pricingMode" "BundlePricingMode" NOT NULL DEFAULT 'PRODUCT_PRICE',
  "minimumSelections" INTEGER,
  "maximumSelections" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductBundle_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductBundle_min_check" CHECK ("minimumSelections" IS NULL OR "minimumSelections" >= 0),
  CONSTRAINT "ProductBundle_max_check" CHECK ("maximumSelections" IS NULL OR "maximumSelections" >= 1),
  CONSTRAINT "ProductBundle_range_check" CHECK ("minimumSelections" IS NULL OR "maximumSelections" IS NULL OR "maximumSelections" >= "minimumSelections")
);

CREATE TABLE "ProductBundleGroup" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bundleId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "minimumSelections" INTEGER NOT NULL DEFAULT 0,
  "maximumSelections" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductBundleGroup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductBundleGroup_min_check" CHECK ("minimumSelections" >= 0),
  CONSTRAINT "ProductBundleGroup_max_check" CHECK ("maximumSelections" IS NULL OR "maximumSelections" >= 1),
  CONSTRAINT "ProductBundleGroup_range_check" CHECK ("maximumSelections" IS NULL OR "maximumSelections" >= "minimumSelections")
);

CREATE TABLE "ProductBundleItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bundleId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "groupId" UUID,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "minimumQuantity" INTEGER NOT NULL DEFAULT 0,
  "maximumQuantity" INTEGER,
  "priceDeltaCents" INTEGER NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductBundleItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductBundleItem_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "ProductBundleItem_min_check" CHECK ("minimumQuantity" >= 0),
  CONSTRAINT "ProductBundleItem_max_check" CHECK ("maximumQuantity" IS NULL OR "maximumQuantity" >= 1),
  CONSTRAINT "ProductBundleItem_range_check" CHECK ("maximumQuantity" IS NULL OR "maximumQuantity" >= "minimumQuantity")
);

CREATE TABLE "ProductPersonalization" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productId" UUID NOT NULL,
  "allowGiftMessage" BOOLEAN NOT NULL DEFAULT false,
  "allowRecipientName" BOOLEAN NOT NULL DEFAULT false,
  "allowSpecialPackaging" BOOLEAN NOT NULL DEFAULT false,
  "specialPackagingCents" INTEGER NOT NULL DEFAULT 0,
  "allowRequestedDate" BOOLEAN NOT NULL DEFAULT false,
  "allowNotes" BOOLEAN NOT NULL DEFAULT false,
  "allowHidePrice" BOOLEAN NOT NULL DEFAULT false,
  "messageMaxLength" INTEGER NOT NULL DEFAULT 300,
  "notesMaxLength" INTEGER NOT NULL DEFAULT 500,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductPersonalization_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductPersonalization_packaging_check" CHECK ("specialPackagingCents" >= 0),
  CONSTRAINT "ProductPersonalization_message_length_check" CHECK ("messageMaxLength" BETWEEN 1 AND 2000),
  CONSTRAINT "ProductPersonalization_notes_length_check" CHECK ("notesMaxLength" BETWEEN 1 AND 4000)
);

CREATE TABLE "CartItemBundleSelection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cartItemId" UUID NOT NULL,
  "componentProductId" UUID NOT NULL,
  "groupId" UUID,
  "quantity" INTEGER NOT NULL,
  "unitPriceDeltaCents" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CartItemBundleSelection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CartItemBundleSelection_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "CartItemPersonalization" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cartItemId" UUID NOT NULL,
  "data" JSONB NOT NULL,
  "extraPriceCents" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CartItemPersonalization_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CartItemPersonalization_extra_check" CHECK ("extraPriceCents" >= 0)
);

CREATE TABLE "OrderItemBundleSelection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "orderItemId" UUID NOT NULL,
  "componentProductId" UUID,
  "componentName" TEXT NOT NULL,
  "componentSku" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPriceDeltaCents" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderItemBundleSelection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderItemBundleSelection_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "OrderItemPersonalization" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "orderItemId" UUID NOT NULL,
  "data" JSONB NOT NULL,
  "extraPriceCents" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderItemPersonalization_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderItemPersonalization_extra_check" CHECK ("extraPriceCents" >= 0)
);

CREATE UNIQUE INDEX "ProductBundle_productId_key" ON "ProductBundle"("productId");
CREATE INDEX "ProductBundle_active_mode_idx" ON "ProductBundle"("isActive", "mode");
CREATE UNIQUE INDEX "ProductBundleGroup_bundleId_code_key" ON "ProductBundleGroup"("bundleId", "code");
CREATE INDEX "ProductBundleGroup_bundleId_sortOrder_idx" ON "ProductBundleGroup"("bundleId", "sortOrder");
CREATE UNIQUE INDEX "ProductBundleItem_bundle_product_group_key" ON "ProductBundleItem"("bundleId", "productId", "groupId");
CREATE INDEX "ProductBundleItem_bundleId_active_sort_idx" ON "ProductBundleItem"("bundleId", "isActive", "sortOrder");
CREATE UNIQUE INDEX "ProductPersonalization_productId_key" ON "ProductPersonalization"("productId");
CREATE UNIQUE INDEX "CartItemBundleSelection_cart_component_group_key" ON "CartItemBundleSelection"("cartItemId", "componentProductId", "groupId");
CREATE UNIQUE INDEX "CartItemPersonalization_cartItemId_key" ON "CartItemPersonalization"("cartItemId");
CREATE INDEX "OrderItemBundleSelection_orderItemId_idx" ON "OrderItemBundleSelection"("orderItemId");
CREATE UNIQUE INDEX "OrderItemPersonalization_orderItemId_key" ON "OrderItemPersonalization"("orderItemId");

ALTER TABLE "ProductBundle" ADD CONSTRAINT "ProductBundle_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductBundleGroup" ADD CONSTRAINT "ProductBundleGroup_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ProductBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductBundleItem" ADD CONSTRAINT "ProductBundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ProductBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductBundleItem" ADD CONSTRAINT "ProductBundleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductBundleItem" ADD CONSTRAINT "ProductBundleItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductBundleGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductPersonalization" ADD CONSTRAINT "ProductPersonalization_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItemBundleSelection" ADD CONSTRAINT "CartItemBundleSelection_cartItemId_fkey" FOREIGN KEY ("cartItemId") REFERENCES "CartItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItemBundleSelection" ADD CONSTRAINT "CartItemBundleSelection_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CartItemBundleSelection" ADD CONSTRAINT "CartItemBundleSelection_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductBundleGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CartItemPersonalization" ADD CONSTRAINT "CartItemPersonalization_cartItemId_fkey" FOREIGN KEY ("cartItemId") REFERENCES "CartItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItemBundleSelection" ADD CONSTRAINT "OrderItemBundleSelection_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItemBundleSelection" ADD CONSTRAINT "OrderItemBundleSelection_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItemPersonalization" ADD CONSTRAINT "OrderItemPersonalization_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
