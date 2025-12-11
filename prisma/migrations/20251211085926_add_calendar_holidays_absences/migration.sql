-- CreateEnum
CREATE TYPE "HolidaySource" AS ENUM ('API', 'MANUAL');

-- CreateEnum
CREATE TYPE "AbsenceType" AS ENUM ('VACATION', 'SICK_LEAVE', 'PERSONAL_LEAVE', 'MATERNITY', 'PATERNITY', 'UNPAID_LEAVE', 'TRAINING', 'OTHER');

-- CreateEnum
CREATE TYPE "AbsenceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "company_locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "country" VARCHAR(2) NOT NULL DEFAULT 'ES',
    "region_code" VARCHAR(10) NOT NULL,
    "region_name" VARCHAR(100) NOT NULL,
    "province_code" VARCHAR(2),
    "province_name" VARCHAR(100),
    "municipality_code" VARCHAR(5),
    "municipality_name" VARCHAR(100),
    "address" VARCHAR(500),
    "postal_code" VARCHAR(10),
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Europe/Madrid',

    CONSTRAINT "company_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_holidays" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "date" DATE NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "local_name" VARCHAR(255),
    "country" VARCHAR(2) NOT NULL,
    "region_code" VARCHAR(10),
    "year" INTEGER NOT NULL,
    "is_fixed" BOOLEAN NOT NULL DEFAULT false,
    "source" "HolidaySource" NOT NULL DEFAULT 'API',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_holidays" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_absences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "type" "AbsenceType" NOT NULL,
    "status" "AbsenceStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_absences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_locations_company_id_key" ON "company_locations"("company_id");

-- CreateIndex
CREATE INDEX "public_holidays_year_country_idx" ON "public_holidays"("year", "country");

-- CreateIndex
CREATE UNIQUE INDEX "public_holidays_date_country_region_code_key" ON "public_holidays"("date", "country", "region_code");

-- CreateIndex
CREATE UNIQUE INDEX "company_holidays_company_id_date_key" ON "company_holidays"("company_id", "date");

-- CreateIndex
CREATE INDEX "user_absences_user_id_start_date_idx" ON "user_absences"("user_id", "start_date");

-- CreateIndex
CREATE INDEX "user_absences_company_id_status_idx" ON "user_absences"("company_id", "status");

-- AddForeignKey
ALTER TABLE "company_locations" ADD CONSTRAINT "company_locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_holidays" ADD CONSTRAINT "company_holidays_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_absences" ADD CONSTRAINT "user_absences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_absences" ADD CONSTRAINT "user_absences_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_absences" ADD CONSTRAINT "user_absences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
