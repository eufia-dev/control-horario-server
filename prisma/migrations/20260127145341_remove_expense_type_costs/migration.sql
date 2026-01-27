/*
  Warnings:

  - You are about to drop the column `expense_type` on the `project_external_cost_actuals` table. All the data in the column will be lost.
  - You are about to drop the column `expense_type` on the `project_external_cost_estimates` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OverheadCostType" ADD VALUE 'TRANSFER_PRICING';
ALTER TYPE "OverheadCostType" ADD VALUE 'OTHER_PROFESSIONALS';
ALTER TYPE "OverheadCostType" ADD VALUE 'STRUCTURE_COSTS';

-- AlterTable
ALTER TABLE "project_external_cost_actuals" DROP COLUMN "expense_type";

-- AlterTable
ALTER TABLE "project_external_cost_estimates" DROP COLUMN "expense_type";

-- DropEnum
DROP TYPE "ExternalCostExpenseType";
