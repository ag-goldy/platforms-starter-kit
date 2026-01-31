-- Add SLA tracking fields to tickets table
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "first_response_at" TIMESTAMP;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "sla_response_target_hours" INTEGER;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "sla_resolution_target_hours" INTEGER;

