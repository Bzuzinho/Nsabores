-- Cabazes que incluem artigos opcionais devem ser configuráveis no website.
-- A alteração preserva cabazes integralmente fixos (todos os componentes obrigatórios).
UPDATE "ProductBundle" AS bundle
SET
  "mode" = 'CONFIGURABLE'::"BundleMode",
  "updatedAt" = CURRENT_TIMESTAMP
WHERE bundle."mode" = 'FIXED'::"BundleMode"
  AND EXISTS (
    SELECT 1
    FROM "ProductBundleItem" AS item
    WHERE item."bundleId" = bundle."id"
      AND item."isActive" = true
      AND item."isRequired" = false
  );

-- Artigos opcionais têm de aceitar quantidade zero para poderem ser retirados.
UPDATE "ProductBundleItem"
SET "minimumQuantity" = 0
WHERE "isRequired" = false
  AND "minimumQuantity" > 0;
