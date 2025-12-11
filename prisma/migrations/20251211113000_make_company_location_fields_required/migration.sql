-- Backfill nullable location fields before enforcing NOT NULL
UPDATE "company_locations" SET "province_code" = 'NA' WHERE "province_code" IS NULL;
UPDATE "company_locations" SET "province_name" = 'Unknown' WHERE "province_name" IS NULL;
UPDATE "company_locations" SET "municipality_code" = '00000' WHERE "municipality_code" IS NULL;
UPDATE "company_locations" SET "municipality_name" = 'Unknown' WHERE "municipality_name" IS NULL;
UPDATE "company_locations" SET "address" = 'Unknown' WHERE "address" IS NULL;
UPDATE "company_locations" SET "postal_code" = '00000' WHERE "postal_code" IS NULL;

-- Enforce required fields
ALTER TABLE "company_locations"
  ALTER COLUMN "province_code" SET NOT NULL,
  ALTER COLUMN "province_name" SET NOT NULL,
  ALTER COLUMN "municipality_code" SET NOT NULL,
  ALTER COLUMN "municipality_name" SET NOT NULL,
  ALTER COLUMN "address" SET NOT NULL,
  ALTER COLUMN "postal_code" SET NOT NULL;
