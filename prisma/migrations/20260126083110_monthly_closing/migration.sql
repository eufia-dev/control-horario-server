-- CreateEnum
CREATE TYPE "MonthClosingStatus" AS ENUM ('OPEN', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "OverheadCostType" AS ENUM ('RENT', 'UTILITIES', 'INSURANCE', 'SOFTWARE_LICENSES', 'MARKETING', 'OFFICE_SUPPLIES', 'PROFESSIONAL_SERVICES', 'TAXES_FEES', 'DEPRECIATION', 'OTHER');

-- CreateTable
CREATE TABLE "monthly_closings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "MonthClosingStatus" NOT NULL DEFAULT 'OPEN',
    "total_salaries" DECIMAL(12,2),
    "total_overhead" DECIMAL(12,2),
    "total_revenue" DECIMAL(12,2),
    "closed_by_id" UUID,
    "closed_at" TIMESTAMPTZ(6),
    "reopened_by_id" UUID,
    "reopened_at" TIMESTAMPTZ(6),
    "reopen_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "monthly_closings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_user_salaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "base_salary_snapshot" DECIMAL(10,2),
    "extras" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "extras_description" VARCHAR(500),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "monthly_user_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_overhead_costs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "cost_type" "OverheadCostType" NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "monthly_overhead_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_monthly_distributions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "closing_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "project_revenue" DECIMAL(12,2) NOT NULL,
    "revenue_share_percent" DECIMAL(5,2) NOT NULL,
    "distributed_salaries" DECIMAL(12,2) NOT NULL,
    "distributed_overhead" DECIMAL(12,2) NOT NULL,
    "total_distributed" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_monthly_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_closings_company_id_year_month_key" ON "monthly_closings"("company_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_user_salaries_company_id_user_id_year_month_key" ON "monthly_user_salaries"("company_id", "user_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "project_monthly_distributions_closing_id_project_id_key" ON "project_monthly_distributions"("closing_id", "project_id");

-- AddForeignKey
ALTER TABLE "monthly_closings" ADD CONSTRAINT "monthly_closings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_closings" ADD CONSTRAINT "monthly_closings_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_closings" ADD CONSTRAINT "monthly_closings_reopened_by_id_fkey" FOREIGN KEY ("reopened_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_user_salaries" ADD CONSTRAINT "monthly_user_salaries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_user_salaries" ADD CONSTRAINT "monthly_user_salaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_overhead_costs" ADD CONSTRAINT "monthly_overhead_costs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_monthly_distributions" ADD CONSTRAINT "project_monthly_distributions_closing_id_fkey" FOREIGN KEY ("closing_id") REFERENCES "monthly_closings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_monthly_distributions" ADD CONSTRAINT "project_monthly_distributions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
