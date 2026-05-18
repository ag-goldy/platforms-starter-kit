ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "deletion_scheduled_at" timestamp,
  ADD COLUMN IF NOT EXISTS "deletion_scheduled_by" text;
