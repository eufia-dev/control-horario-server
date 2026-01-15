/*
  Warnings:

  - You are about to drop the `external_hours` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `external_workers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_financial_items` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ExternalCostExpenseType" AS ENUM ('TRANSFER_PRICING', 'PROJECT_EXTERNALS', 'OTHER_PROFESSIONALS', 'STRUCTURE_COSTS', 'OTHER');

-- DropForeignKey
ALTER TABLE "external_hours" DROP CONSTRAINT "external_hours_company_id_fkey";

-- DropForeignKey
ALTER TABLE "external_hours" DROP CONSTRAINT "external_hours_external_worker_id_fkey";

-- DropForeignKey
ALTER TABLE "external_hours" DROP CONSTRAINT "external_hours_project_id_fkey";

-- DropForeignKey
ALTER TABLE "external_workers" DROP CONSTRAINT "external_workers_company_id_fkey";

-- DropForeignKey
ALTER TABLE "project_financial_items" DROP CONSTRAINT "project_financial_items_project_id_fkey";

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "has_cash_flow_feature" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "client_name" VARCHAR(255),
ADD COLUMN     "delegation" VARCHAR(100);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "salary" DECIMAL(10,2);

-- DropTable
DROP TABLE "external_hours";

-- DropTable
DROP TABLE "external_workers";

-- DropTable
DROP TABLE "project_financial_items";

-- DropEnum
DROP TYPE "FinancialCategory";

-- DropEnum
DROP TYPE "FinancialType";

-- CreateTable
CREATE TABLE "project_monthly_revenues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "estimated_revenue" DECIMAL(12,2),
    "actual_revenue" DECIMAL(12,2),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "project_monthly_revenues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_external_cost_estimates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "provider" VARCHAR(255),
    "expense_type" "ExternalCostExpenseType",
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "project_external_cost_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_external_cost_actuals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "provider" VARCHAR(255) NOT NULL,
    "expense_type" "ExternalCostExpenseType" NOT NULL,
    "description" VARCHAR(500),
    "payment_period" VARCHAR(100),
    "is_billed" BOOLEAN NOT NULL DEFAULT false,
    "issue_date" DATE,
    "due_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "project_external_cost_actuals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_monthly_revenues_project_id_year_month_key" ON "project_monthly_revenues"("project_id", "year", "month");

-- AddForeignKey
ALTER TABLE "project_monthly_revenues" ADD CONSTRAINT "project_monthly_revenues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_external_cost_estimates" ADD CONSTRAINT "project_external_cost_estimates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_external_cost_actuals" ADD CONSTRAINT "project_external_cost_actuals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
