-- Existing products were sellable without quantitative stock. Keep tracking
-- disabled until an operator registers the opening quantity in Management.
INSERT INTO "StockItem" (
  "id",
  "productId",
  "onHandQuantity",
  "reservedQuantity",
  "trackStock",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  product."id",
  0,
  0,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Product" AS product
LEFT JOIN "StockItem" AS stock ON stock."productId" = product."id"
WHERE stock."id" IS NULL;
