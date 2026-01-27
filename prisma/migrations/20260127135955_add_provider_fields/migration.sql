-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "cif" VARCHAR(50),
ADD COLUMN     "email" VARCHAR(320),
ADD COLUMN     "fiscal_name" VARCHAR(255),
ADD COLUMN     "location" VARCHAR(500),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" VARCHAR(50),
ADD COLUMN     "type" VARCHAR(100);
