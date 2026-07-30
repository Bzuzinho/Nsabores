CREATE TYPE "ProductionPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TYPE "ProductionWorkStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED');

CREATE TABLE "ProductionWorkOrder" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "status" "ProductionWorkStatus" NOT NULL DEFAULT 'QUEUED',
  "priority" "ProductionPriority" NOT NULL DEFAULT 'NORMAL',
  "targetDate" TIMESTAMP(3),
  "responsibleUserId" UUID,
  "productionNotes" TEXT,
  "startedAt" TIMESTAMP(3),
  "readyAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionWorkOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductionWorkOrder_orderId_key" UNIQUE ("orderId"),
  CONSTRAINT "ProductionWorkOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductionWorkOrder_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ProductionWorkOrder_status_priority_targetDate_idx"
  ON "ProductionWorkOrder" ("status", "priority", "targetDate");
CREATE INDEX "ProductionWorkOrder_responsibleUserId_status_idx"
  ON "ProductionWorkOrder" ("responsibleUserId", "status");
