-- Phase 3.8.1 & 3.8.3: Data Retention and Anonymization
-- Add data retention and anonymization support

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "data_retention_days" INTEGER;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "retention_policy" TEXT CHECK (retention_policy IN ('KEEP_FOREVER', 'DELETE_AFTER_DAYS', 'ANONYMIZE_AFTER_DAYS'));

-- Add soft delete support to tickets
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_tickets_deleted_at ON tickets(deleted_at) WHERE deleted_at IS NOT NULL;

-- Add soft delete support to ticket comments
ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_comments_deleted_at ON ticket_comments(deleted_at) WHERE deleted_at IS NOT NULL;

-- Add anonymization flags
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "is_anonymized" BOOLEAN DEFAULT false;
ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "is_anonymized" BOOLEAN DEFAULT false;

