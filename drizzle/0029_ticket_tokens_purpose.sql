-- Migration: Add missing columns to ticket_tokens table
-- Created: 2026-02-09

-- Create enum type if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_token_purpose') THEN
    CREATE TYPE ticket_token_purpose AS ENUM ('VIEW', 'REPLY');
  END IF;
END $$;

-- Add purpose column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_tokens' AND column_name = 'purpose'
  ) THEN
    ALTER TABLE ticket_tokens ADD COLUMN purpose ticket_token_purpose NOT NULL DEFAULT 'VIEW';
  END IF;
END $$;

-- Add last_sent_at column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_tokens' AND column_name = 'last_sent_at'
  ) THEN
    ALTER TABLE ticket_tokens ADD COLUMN last_sent_at timestamp;
  END IF;
END $$;

-- Add created_ip column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_tokens' AND column_name = 'created_ip'
  ) THEN
    ALTER TABLE ticket_tokens ADD COLUMN created_ip text;
  END IF;
END $$;

-- Add used_ip column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_tokens' AND column_name = 'used_ip'
  ) THEN
    ALTER TABLE ticket_tokens ADD COLUMN used_ip text;
  END IF;
END $$;
