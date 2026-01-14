/*
  Warnings:

  - The values [SICK_LEAVE,PERSONAL_LEAVE,MATERNITY,PATERNITY,UNPAID_LEAVE] on the enum `AbsenceType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AbsenceType_new" AS ENUM ('VACATION', 'SICK_LEAVE_COMMON', 'SICK_LEAVE_PROFESSIONAL', 'ACCIDENT_LEAVE_NON_WORK', 'ACCIDENT_LEAVE_WORK', 'PARENTAL_LEAVE', 'NURSING_LEAVE', 'MARRIAGE', 'FAMILY_BEREAVEMENT_HOSPITALIZATION', 'TRAINING', 'OTHER');
ALTER TABLE "user_absences" ALTER COLUMN "type" TYPE "AbsenceType_new" USING ("type"::text::"AbsenceType_new");
ALTER TYPE "AbsenceType" RENAME TO "AbsenceType_old";
ALTER TYPE "AbsenceType_new" RENAME TO "AbsenceType";
DROP TYPE "public"."AbsenceType_old";
COMMIT;
