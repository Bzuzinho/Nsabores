-- Add fulfillment relations that depend on commerce and B2B tables created
-- after the original fulfillment migration. Guards keep this safe for
-- databases where the constraints were already created historically.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Shipment_orderId_fkey'
  ) THEN
    ALTER TABLE "Shipment"
      ADD CONSTRAINT "Shipment_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShipmentItem_orderItemId_fkey'
  ) THEN
    ALTER TABLE "ShipmentItem"
      ADD CONSTRAINT "ShipmentItem_orderItemId_fkey"
      FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReturnRequest_orderId_fkey'
  ) THEN
    ALTER TABLE "ReturnRequest"
      ADD CONSTRAINT "ReturnRequest_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReturnItem_orderItemId_fkey'
  ) THEN
    ALTER TABLE "ReturnItem"
      ADD CONSTRAINT "ReturnItem_orderItemId_fkey"
      FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportCase_businessAccountId_fkey'
  ) THEN
    ALTER TABLE "SupportCase"
      ADD CONSTRAINT "SupportCase_businessAccountId_fkey"
      FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportCase_orderId_fkey'
  ) THEN
    ALTER TABLE "SupportCase"
      ADD CONSTRAINT "SupportCase_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
