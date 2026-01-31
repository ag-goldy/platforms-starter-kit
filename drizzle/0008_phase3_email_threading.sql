-- Phase 3.2: Email as First-Class Channel
-- Add email threading support

-- Add message ID and threading columns to ticket_comments
ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "message_id" TEXT;
ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "in_reply_to" TEXT;
ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "references" TEXT;

-- Add email thread ID to tickets
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "email_thread_id" TEXT;

-- Create index for message ID lookups
CREATE INDEX IF NOT EXISTS idx_comments_message_id ON ticket_comments(message_id);
CREATE INDEX IF NOT EXISTS idx_comments_in_reply_to ON ticket_comments(in_reply_to);
CREATE INDEX IF NOT EXISTS idx_tickets_email_thread_id ON tickets(email_thread_id);

