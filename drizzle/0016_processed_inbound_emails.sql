-- Migration: Add processed inbound email idempotency table
-- Purpose: prevent duplicate ticket/comment creation from at-least-once inbound email webhooks

CREATE TABLE "processed_inbound_emails" (
  "internet_message_id" text PRIMARY KEY,
  "processed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ticket_id" uuid REFERENCES "tickets"("id") ON DELETE SET NULL,
  "org_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
  "source" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "processed_inbound_emails_source_check"
    CHECK ("source" IN ('graph', 'generic_inbound'))
);

CREATE INDEX "idx_processed_inbound_emails_processed_at"
  ON "processed_inbound_emails" ("processed_at");
