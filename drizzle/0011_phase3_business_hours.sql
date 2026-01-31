-- Phase 3.5.1: Business Hours Configuration
-- Add business hours configuration to organizations

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "business_hours" JSONB;

-- Example structure:
-- {
--   "timezone": "America/New_York",
--   "workingDays": [1,2,3,4,5],  -- Monday=1, Sunday=7
--   "workingHours": {"start": "09:00", "end": "17:00"},
--   "holidays": ["2024-12-25", "2024-01-01"]
-- }

