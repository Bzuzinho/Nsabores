UPDATE "ProductBundle" AS bundle
SET
  "mode" = 'CONFIGURABLE'::"BundleMode",
  "pricingMode" = 'COMPONENT_TOTAL'::"BundlePricingMode",
  "minimumSelections" = 1,
  "maximumSelections" = 12,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Product" AS product
WHERE bundle."productId" = product."id"
  AND product."sku" = 'CAB-PORTUGAL';

UPDATE "ProductBundleItem" AS item
SET
  "quantity" = 1,
  "isRequired" = false,
  "minimumQuantity" = 0,
  "maximumQuantity" = 4,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ProductBundle" AS bundle
JOIN "Product" AS product ON product."id" = bundle."productId"
WHERE item."bundleId" = bundle."id"
  AND product."sku" = 'CAB-PORTUGAL';
