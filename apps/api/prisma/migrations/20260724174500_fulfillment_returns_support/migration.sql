-- Sprint 6: fulfillment, shipping, returns and after-sales support

CREATE TYPE "ShipmentStatus" AS ENUM (
  'PENDING', 'READY', 'LABEL_CREATED', 'IN_TRANSIT',
  'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED'
);

CREATE TYPE "ReturnRequestStatus" AS ENUM (
  'REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED',
  'IN_TRANSIT', 'RECEIVED', 'INSPECTED', 'REFUND_PENDING',
  'REFUNDED', 'CLOSED', 'CANCELLED'
);

CREATE TYPE "ReturnResolution" AS ENUM ('REFUND', 'REPLACEMENT', 'CREDIT', 'OTHER');
CREATE TYPE "ReturnItemDisposition" AS ENUM ('RESTOCK', 'UNSELLABLE', 'RETURN_TO_SUPPLIER', 'DESTROY');
CREATE TYPE "SupportCaseType" AS ENUM (
  'DELAY', 'LOST_SHIPMENT', 'DAMAGED_PACKAGE', 'DAMAGED_PRODUCT',
  'MISSING_ITEM', 'WRONG_ITEM', 'FAILED_DELIVERY', 'RETURN_TO_SENDER', 'OTHER'
);
CREATE TYPE "SupportCasePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "SupportCaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_CARRIER', 'RESOLVED', 'CLOSED');

CREATE TABLE "Shipment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL,
  "number" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "service" TEXT NOT NULL,
  "trackingNumber" TEXT,
  "trackingUrl" TEXT,
  "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
  "weightGrams" INTEGER,
  "lengthMm" INTEGER,
  "widthMm" INTEGER,
  "heightMm" INTEGER,
  "costCents" INTEGER NOT NULL DEFAULT 0,
  "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
  "labelUrl" TEXT,
  "providerShipmentId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "shippedAt" TIMESTAMP(3),
  "estimatedDeliveryAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShipmentItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shipmentId" UUID NOT NULL,
  "orderItemId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShipmentItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShipmentEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shipmentId" UUID NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "location" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReturnRequest" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "number" TEXT NOT NULL,
  "orderId" UUID NOT NULL,
  "userId" UUID,
  "status" "ReturnRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "resolution" "ReturnResolution" NOT NULL,
  "reason" TEXT NOT NULL,
  "customerNotes" TEXT,
  "internalNotes" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReturnItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "returnRequestId" UUID NOT NULL,
  "orderItemId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "declaredCondition" TEXT,
  "receivedCondition" TEXT,
  "disposition" "ReturnItemDisposition",
  "eligibleRefundCents" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReturnEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "returnRequestId" UUID NOT NULL,
  "fromStatus" "ReturnRequestStatus",
  "toStatus" "ReturnRequestStatus" NOT NULL,
  "authorId" UUID,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportCase" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "number" TEXT NOT NULL,
  "userId" UUID,
  "businessAccountId" UUID,
  "orderId" UUID,
  "shipmentId" UUID,
  "type" "SupportCaseType" NOT NULL,
  "priority" "SupportCasePriority" NOT NULL DEFAULT 'NORMAL',
  "status" "SupportCaseStatus" NOT NULL DEFAULT 'OPEN',
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "resolution" TEXT,
  "assignedToId" UUID,
  "dueAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportCaseComment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "supportCaseId" UUID NOT NULL,
  "authorId" UUID,
  "body" TEXT NOT NULL,
  "isInternal" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportCaseComment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Shipment_number_key" ON "Shipment"("number");
CREATE UNIQUE INDEX "Shipment_idempotencyKey_key" ON "Shipment"("idempotencyKey");
CREATE UNIQUE INDEX "Shipment_provider_providerShipmentId_key" ON "Shipment"("provider", "providerShipmentId");
CREATE INDEX "Shipment_orderId_status_idx" ON "Shipment"("orderId", "status");
CREATE INDEX "Shipment_status_createdAt_idx" ON "Shipment"("status", "createdAt");
CREATE UNIQUE INDEX "ShipmentItem_shipmentId_orderItemId_key" ON "ShipmentItem"("shipmentId", "orderItemId");
CREATE INDEX "ShipmentItem_orderItemId_idx" ON "ShipmentItem"("orderItemId");
CREATE UNIQUE INDEX "ShipmentEvent_shipmentId_providerEventId_key" ON "ShipmentEvent"("shipmentId", "providerEventId");
CREATE INDEX "ShipmentEvent_shipmentId_occurredAt_idx" ON "ShipmentEvent"("shipmentId", "occurredAt");
CREATE UNIQUE INDEX "ReturnRequest_number_key" ON "ReturnRequest"("number");
CREATE INDEX "ReturnRequest_orderId_status_idx" ON "ReturnRequest"("orderId", "status");
CREATE INDEX "ReturnRequest_userId_createdAt_idx" ON "ReturnRequest"("userId", "createdAt");
CREATE UNIQUE INDEX "ReturnItem_returnRequestId_orderItemId_key" ON "ReturnItem"("returnRequestId", "orderItemId");
CREATE INDEX "ReturnEvent_returnRequestId_createdAt_idx" ON "ReturnEvent"("returnRequestId", "createdAt");
CREATE UNIQUE INDEX "SupportCase_number_key" ON "SupportCase"("number");
CREATE INDEX "SupportCase_status_priority_createdAt_idx" ON "SupportCase"("status", "priority", "createdAt");
CREATE INDEX "SupportCase_orderId_idx" ON "SupportCase"("orderId");
CREATE INDEX "SupportCase_businessAccountId_idx" ON "SupportCase"("businessAccountId");
CREATE INDEX "SupportCaseComment_supportCaseId_createdAt_idx" ON "SupportCaseComment"("supportCaseId", "createdAt");

ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnEvent" ADD CONSTRAINT "ReturnEvent_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnEvent" ADD CONSTRAINT "ReturnEvent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCaseComment" ADD CONSTRAINT "SupportCaseComment_supportCaseId_fkey" FOREIGN KEY ("supportCaseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportCaseComment" ADD CONSTRAINT "SupportCaseComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_refund_check" CHECK ("eligibleRefundCents" >= 0);
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_cost_check" CHECK ("costCents" >= 0);
