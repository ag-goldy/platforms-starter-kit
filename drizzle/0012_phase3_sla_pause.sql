-- Phase 3.5.2: SLA Pause Conditions
-- Add SLA pause tracking to tickets

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "sla_paused_at" TIMESTAMP;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "sla_pause_reason" TEXT;

-- Create index for efficient pause queries
CREATE INDEX IF NOT EXISTS idx_tickets_sla_paused ON tickets(sla_paused_at) WHERE sla_paused_at IS NOT NULL;

