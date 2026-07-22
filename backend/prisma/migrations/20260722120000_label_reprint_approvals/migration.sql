-- Label reprint approvals — "the lock".
--
-- Additive only. Minting is NOT touched: a QR is still created exactly once, at
-- registration (MC) or at output confirm (FG). This gates only REPRINTS of labels
-- that have already been printed once.
--
-- Nothing here changes the meaning of an existing column, and no existing row is
-- rewritten: every Material/FinishedGood starts with labelPrintedAt = NULL, i.e.
-- "not yet printed", so each still gets its one approval-free print.

CREATE TYPE "LabelScope"    AS ENUM ('PO_LABELS', 'MC_UNIT_LABEL', 'FG_OUTPUT_LABELS', 'FG_UNIT_LABEL');
CREATE TYPE "ReprintStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CONSUMED');

-- When this label was FIRST printed, in any export format. NULL = never printed.
ALTER TABLE "Material"     ADD COLUMN "labelPrintedAt" TIMESTAMP(3);
ALTER TABLE "FinishedGood" ADD COLUMN "labelPrintedAt" TIMESTAMP(3);

CREATE TABLE "LabelReprintRequest" (
    "id"             TEXT            NOT NULL,
    "scope"          "LabelScope"    NOT NULL,
    "poId"           TEXT,
    "materialId"     TEXT,
    "outputId"       TEXT,
    "finishedGoodId" TEXT,
    "reason"         TEXT            NOT NULL,
    "status"         "ReprintStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById"  TEXT            NOT NULL,
    "requestedAt"    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById"    TEXT,
    "decidedAt"      TIMESTAMP(3),
    "decisionNote"   TEXT,
    -- The Admin decides how many prints an approval buys; the request re-locks when
    -- printsUsed reaches printsApproved.
    "printsApproved" INTEGER         NOT NULL DEFAULT 0,
    "printsUsed"     INTEGER         NOT NULL DEFAULT 0,
    "lastPrintedAt"  TIMESTAMP(3),

    CONSTRAINT "LabelReprintRequest_pkey" PRIMARY KEY ("id")
);

-- Exactly one target, and it must match the declared scope. Prisma cannot express a
-- CHECK, so this lives only here — it is the guarantee that a request can never point
-- at two different things or at nothing at all.
ALTER TABLE "LabelReprintRequest" ADD CONSTRAINT "LabelReprintRequest_one_target" CHECK (
    ("scope" = 'PO_LABELS'        AND "poId"           IS NOT NULL AND "materialId" IS NULL AND "outputId"   IS NULL AND "finishedGoodId" IS NULL) OR
    ("scope" = 'MC_UNIT_LABEL'    AND "materialId"     IS NOT NULL AND "poId"       IS NULL AND "outputId"   IS NULL AND "finishedGoodId" IS NULL) OR
    ("scope" = 'FG_OUTPUT_LABELS' AND "outputId"       IS NOT NULL AND "poId"       IS NULL AND "materialId" IS NULL AND "finishedGoodId" IS NULL) OR
    ("scope" = 'FG_UNIT_LABEL'    AND "finishedGoodId" IS NOT NULL AND "poId"       IS NULL AND "materialId" IS NULL AND "outputId"       IS NULL)
);

-- A quota can never be negative, and can never be over-spent.
ALTER TABLE "LabelReprintRequest" ADD CONSTRAINT "LabelReprintRequest_quota_sane" CHECK (
    "printsApproved" >= 0 AND "printsUsed" >= 0 AND "printsUsed" <= "printsApproved"
);

ALTER TABLE "LabelReprintRequest" ADD CONSTRAINT "LabelReprintRequest_poId_fkey"
    FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabelReprintRequest" ADD CONSTRAINT "LabelReprintRequest_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabelReprintRequest" ADD CONSTRAINT "LabelReprintRequest_outputId_fkey"
    FOREIGN KEY ("outputId") REFERENCES "ProductionOutput"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabelReprintRequest" ADD CONSTRAINT "LabelReprintRequest_finishedGoodId_fkey"
    FOREIGN KEY ("finishedGoodId") REFERENCES "FinishedGood"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabelReprintRequest" ADD CONSTRAINT "LabelReprintRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LabelReprintRequest" ADD CONSTRAINT "LabelReprintRequest_decidedById_fkey"
    FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "LabelReprintRequest_status_idx"         ON "LabelReprintRequest"("status");
CREATE INDEX "LabelReprintRequest_poId_idx"           ON "LabelReprintRequest"("poId");
CREATE INDEX "LabelReprintRequest_materialId_idx"     ON "LabelReprintRequest"("materialId");
CREATE INDEX "LabelReprintRequest_outputId_idx"       ON "LabelReprintRequest"("outputId");
CREATE INDEX "LabelReprintRequest_finishedGoodId_idx" ON "LabelReprintRequest"("finishedGoodId");
