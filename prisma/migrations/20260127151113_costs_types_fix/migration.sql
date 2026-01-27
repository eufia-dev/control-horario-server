/*
  Warnings:

  - The values [RENT,UTILITIES,INSURANCE,SOFTWARE_LICENSES,MARKETING,OFFICE_SUPPLIES,PROFESSIONAL_SERVICES,TAXES_FEES,DEPRECIATION] on the enum `OverheadCostType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OverheadCostType_new" AS ENUM ('TRANSFER_PRICING', 'OTHER_PROFESSIONALS', 'STRUCTURE_COSTS', 'OTHER');
ALTER TABLE "monthly_overhead_costs" ALTER COLUMN "cost_type" TYPE "OverheadCostType_new" USING ("cost_type"::text::"OverheadCostType_new");
ALTER TYPE "OverheadCostType" RENAME TO "OverheadCostType_old";
ALTER TYPE "OverheadCostType_new" RENAME TO "OverheadCostType";
DROP TYPE "public"."OverheadCostType_old";
COMMIT;
