-- Add additional user detail fields
-- Add phone, job_title, department, and notes columns to users table

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "job_title" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notes" text;

