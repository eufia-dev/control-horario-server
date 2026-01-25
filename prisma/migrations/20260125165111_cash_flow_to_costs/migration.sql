/*
  Warnings:

  - You are about to drop the column `has_cash_flow_feature` on the `companies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "companies" DROP COLUMN "has_cash_flow_feature",
ADD COLUMN     "has_costs_feature" BOOLEAN NOT NULL DEFAULT false;
