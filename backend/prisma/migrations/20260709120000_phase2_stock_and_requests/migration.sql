-- Phase 2: production requests + append-only stock ledger + per-unit live balance.
-- Fully ADDITIVE / non-destructive — Phase 1 tables, columns and enum values are
-- untouched, so the currently-deployed Phase 1 backend keeps working unchanged.

-- New Role values (used later by the setup script, NOT referenced in this migration).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OVERSIGHT';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PRODUCTION_HEAD';

-- New enums.
CREATE TYPE "Department" AS ENUM ('PU', 'ENAMEL', 'POWDER');
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'PARTIAL', 'REJECTED');
CREATE TYPE "StockTxnType" AS ENUM ('ADD', 'DEDUCT', 'DISCARD');

-- Additive columns.
ALTER TABLE "User" ADD COLUMN "department" "Department";
ALTER TABLE "Material" ADD COLUMN "balanceKg" DOUBLE PRECISION;

-- Production requests (per-material).
CREATE TABLE "ProductionRequest" (
    "id" TEXT NOT NULL,
    "department" "Department" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "sku" TEXT,
    "catalogueItemId" TEXT,
    "requestedKg" DOUBLE PRECISION NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedKg" DOUBLE PRECISION,
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "issuedKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductionRequest_pkey" PRIMARY KEY ("id")
);

-- Append-only stock ledger.
CREATE TABLE "StockTransaction" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "type" "StockTxnType" NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "department" "Department",
    "requestId" TEXT,
    "actorId" TEXT NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockTransaction_pkey" PRIMARY KEY ("id")
);

-- Indexes.
CREATE INDEX "ProductionRequest_department_idx" ON "ProductionRequest"("department");
CREATE INDEX "ProductionRequest_status_idx" ON "ProductionRequest"("status");
CREATE INDEX "ProductionRequest_requestedById_idx" ON "ProductionRequest"("requestedById");
CREATE INDEX "StockTransaction_materialId_idx" ON "StockTransaction"("materialId");
CREATE INDEX "StockTransaction_type_idx" ON "StockTransaction"("type");
CREATE INDEX "StockTransaction_department_idx" ON "StockTransaction"("department");
CREATE INDEX "StockTransaction_requestId_idx" ON "StockTransaction"("requestId");
CREATE INDEX "StockTransaction_createdAt_idx" ON "StockTransaction"("createdAt");

-- Foreign keys.
ALTER TABLE "ProductionRequest" ADD CONSTRAINT "ProductionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionRequest" ADD CONSTRAINT "ProductionRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProductionRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: seed the live balance for already-weighed (READY_FOR_PRODUCTION) units
-- from their Phase 1 receivedWeight. Un-weighed units stay NULL and are blocked from
-- Phase 2 stock actions until weighed.
UPDATE "Material"
SET "balanceKg" = "receivedWeight"
WHERE "status" = 'READY_FOR_PRODUCTION' AND "receivedWeight" IS NOT NULL;
