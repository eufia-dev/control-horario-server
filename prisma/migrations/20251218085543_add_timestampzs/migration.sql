-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "timestamp" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "company_holidays" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "external_hours" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "external_workers" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "project_financial_items" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "public_holidays" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "time_entries" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(6);
