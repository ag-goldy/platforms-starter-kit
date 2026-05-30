-- Migration: Add ticket_id linkage to email_outbox
-- Purpose: preserve ticket context for queued and immediate outbound email tracking

ALTER TABLE "email_outbox"
  ADD COLUMN "ticket_id" uuid REFERENCES "tickets"("id") ON DELETE SET NULL;

CREATE INDEX "idx_email_outbox_ticket_id"
  ON "email_outbox" ("ticket_id")
  WHERE "ticket_id" IS NOT NULL;
