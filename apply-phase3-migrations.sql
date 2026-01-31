-- Phase 3 Database Migrations
-- Run this SQL script directly in your PostgreSQL database
-- You can use psql, pgAdmin, DBeaver, or any PostgreSQL client

-- SLA Pause Conditions
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "sla_paused_at" TIMESTAMP;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "sla_pause_reason" TEXT;
CREATE INDEX IF NOT EXISTS idx_tickets_sla_paused ON tickets(sla_paused_at) WHERE sla_paused_at IS NOT NULL;

-- Business Hours Configuration
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "business_hours" JSONB;

-- Virus Scanning
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "scan_status" TEXT DEFAULT 'PENDING';
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "scan_result" TEXT;
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "scanned_at" TIMESTAMP;
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "is_quarantined" BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_attachments_scan_status ON attachments(scan_status);
CREATE INDEX IF NOT EXISTS idx_attachments_quarantined ON attachments(is_quarantined) WHERE is_quarantined = true;

-- Canned Responses
CREATE TABLE IF NOT EXISTS "canned_responses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "content" text NOT NULL,
  "shortcut" text,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_canned_responses_org ON canned_responses(org_id);
CREATE INDEX IF NOT EXISTS idx_canned_responses_shortcut ON canned_responses(org_id, shortcut) WHERE shortcut IS NOT NULL;

-- Ticket Links
CREATE TABLE IF NOT EXISTS "ticket_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_ticket_id" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "target_ticket_id" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "link_type" text NOT NULL CHECK (link_type IN ('related', 'duplicate', 'blocks', 'blocked_by')),
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE(source_ticket_id, target_ticket_id, link_type)
);
CREATE INDEX IF NOT EXISTS idx_ticket_links_source ON ticket_links(source_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_links_target ON ticket_links(target_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_links_type ON ticket_links(link_type);

-- Data Retention and Anonymization
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "data_retention_days" INTEGER;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "retention_policy" TEXT CHECK (retention_policy IN ('KEEP_FOREVER', 'DELETE_AFTER_DAYS', 'ANONYMIZE_AFTER_DAYS'));

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_tickets_deleted_at ON tickets(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_comments_deleted_at ON ticket_comments(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "is_anonymized" BOOLEAN DEFAULT false;
ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "is_anonymized" BOOLEAN DEFAULT false;

