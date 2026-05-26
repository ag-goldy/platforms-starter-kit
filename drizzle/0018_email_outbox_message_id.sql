-- Migration: Add message_id to email_outbox for outbound Message-ID tracking
-- Purpose: store captured Graph draft-then-send Message-IDs on outbox rows

ALTER TABLE "email_outbox" ADD COLUMN "message_id" text;
