-- Migration: Add outbound_message_id to ticket_comments for reply threading
-- Purpose: capture Graph draft-then-send Message-IDs to match inbound replies via In-Reply-To

ALTER TABLE "ticket_comments" ADD COLUMN "outbound_message_id" text;

CREATE INDEX "idx_ticket_comments_outbound_message_id"
  ON "ticket_comments" ("outbound_message_id")
  WHERE "outbound_message_id" IS NOT NULL;
