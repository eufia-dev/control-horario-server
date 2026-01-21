/*
  Warnings:

  - You are about to drop the column `due_date` on the `project_external_cost_actuals` table. All the data in the column will be lost.
  - You are about to drop the column `payment_period` on the `project_external_cost_actuals` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `project_external_cost_actuals` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `project_external_cost_estimates` table. All the data in the column will be lost.
  - Added the required column `provider_id` to the `project_external_cost_actuals` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "project_external_cost_actuals" DROP COLUMN "due_date",
DROP COLUMN "payment_period",
DROP COLUMN "provider",
ADD COLUMN     "provider_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "project_external_cost_estimates" DROP COLUMN "provider",
ADD COLUMN     "provider_id" UUID;

-- CreateTable
CREATE TABLE "providers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "payment_period" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "providers_company_id_name_key" ON "providers"("company_id", "name");

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_external_cost_estimates" ADD CONSTRAINT "project_external_cost_estimates_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_external_cost_actuals" ADD CONSTRAINT "project_external_cost_actuals_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
