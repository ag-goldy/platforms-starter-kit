-- Migration: Add last_attempt_at to email_outbox for worker attempt tracking
-- Purpose: track when BullMQ last attempted to process a queued email

ALTER TABLE "email_outbox" ADD COLUMN "last_attempt_at" timestamp with time zone;
