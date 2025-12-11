/*
  Warnings:

  - You are about to drop the column `municipality_code` on the `company_locations` table. All the data in the column will be lost.
  - You are about to drop the column `province_name` on the `company_locations` table. All the data in the column will be lost.
  - You are about to drop the column `region_name` on the `company_locations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "company_locations" DROP COLUMN "municipality_code",
DROP COLUMN "province_name",
DROP COLUMN "region_name";
