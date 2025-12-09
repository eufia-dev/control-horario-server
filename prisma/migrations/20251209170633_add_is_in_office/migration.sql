-- AlterTable
ALTER TABLE "active_timers" ADD COLUMN     "is_in_office" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "is_in_office" BOOLEAN NOT NULL DEFAULT false;
