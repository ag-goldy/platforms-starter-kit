-- Migration: Make org_id nullable in tickets and attachments tables for public tickets
-- Created: 2026-02-09

-- Make tickets.org_id nullable
ALTER TABLE tickets ALTER COLUMN org_id DROP NOT NULL;

-- Make attachments.org_id nullable  
ALTER TABLE attachments ALTER COLUMN org_id DROP NOT NULL;

-- Add comments to explain the change
COMMENT ON COLUMN tickets.org_id IS 'Organization ID. NULL for public tickets created via email or support form without org association.';
COMMENT ON COLUMN attachments.org_id IS 'Organization ID. NULL for attachments on public tickets.';
