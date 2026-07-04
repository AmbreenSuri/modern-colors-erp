-- Priority 1/2 post-demo changes: dedicated HSN code column (was wrongly stored under
-- SKU) and a dedicated per-package Weight column. All additive & nullable, so the
-- previously deployed code keeps working until the new build ships.

ALTER TABLE "MasterCatalogueItem" ADD COLUMN "hsnCode" TEXT;

ALTER TABLE "POLineItem" ADD COLUMN "hsnCode" TEXT;
ALTER TABLE "POLineItem" ADD COLUMN "weight" DOUBLE PRECISION;

ALTER TABLE "Material" ADD COLUMN "hsnCode" TEXT;
ALTER TABLE "Material" ADD COLUMN "weight" DOUBLE PRECISION;
