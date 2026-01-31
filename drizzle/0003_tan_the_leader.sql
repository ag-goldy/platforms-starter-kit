-- Fix missing category column in tickets table
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "category" ticket_category DEFAULT 'INCIDENT' NOT NULL;
