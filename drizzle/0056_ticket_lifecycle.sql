ALTER TYPE "ticket_status" ADD VALUE IF NOT EXISTS 'MERGED';

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "auto_close_resolved_days" integer DEFAULT 7 NOT NULL;
