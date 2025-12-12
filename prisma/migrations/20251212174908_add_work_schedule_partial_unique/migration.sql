-- Create partial unique index to ensure only one company default schedule per day
-- This allows multiple NULL user_id values but enforces uniqueness for company defaults
CREATE UNIQUE INDEX IF NOT EXISTS "work_schedules_company_default_unique" 
ON "work_schedules" ("company_id", "day_of_week") 
WHERE "user_id" IS NULL;

-- Backfill: Create default Mon-Fri 09:00-17:00 schedules for existing companies that don't have defaults
-- This ensures all companies have a baseline schedule
INSERT INTO "work_schedules" ("id", "company_id", "user_id", "day_of_week", "start_time", "end_time")
SELECT 
  gen_random_uuid(),
  c.id,
  NULL,
  day_num,
  '09:00',
  '17:00'
FROM "companies" c
CROSS JOIN generate_series(0, 4) AS day_num  -- 0=Monday, 4=Friday
WHERE NOT EXISTS (
  SELECT 1 
  FROM "work_schedules" ws 
  WHERE ws."company_id" = c.id 
    AND ws."user_id" IS NULL 
    AND ws."day_of_week" = day_num
);

