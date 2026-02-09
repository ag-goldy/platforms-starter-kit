-- Fix database issues script
-- Run this to fix enum values and missing columns

-- 1. Fix asset_type enum - add missing values
DO $$
BEGIN
  -- Check if SWITCH exists in asset_type enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'SWITCH' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'asset_type')
  ) THEN
    -- Add SWITCH if it doesn't exist
    ALTER TYPE asset_type ADD VALUE 'SWITCH';
  END IF;
END $$;

-- 2. Fix asset_status enum - ensure ACTIVE exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'ACTIVE' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'asset_status')
  ) THEN
    ALTER TYPE asset_status ADD VALUE 'ACTIVE';
  END IF;
END $$;

-- 3. Add token_hash column to ticket_tokens if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_tokens' 
    AND column_name = 'token_hash'
  ) THEN
    ALTER TABLE ticket_tokens ADD COLUMN token_hash TEXT;
  END IF;
END $$;

-- 4. Add notifications table if missing
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'TICKET_CREATED', 'TICKET_UPDATED', 'TICKET_ASSIGNED', 'TICKET_COMMENTED',
    'TICKET_STATUS_CHANGED', 'TICKET_PRIORITY_CHANGED', 'TICKET_RESOLVED',
    'TICKET_REOPENED', 'TICKET_MERGED', 'TICKET_ESCALATED', 'TICKET_SLA_BREACH',
    'TICKET_SLA_WARNING', 'USER_MENTIONED', 'ORG_INVITATION', 'ORG_ROLE_CHANGED',
    'INTERNAL_GROUP_ASSIGNED', 'AUTOMATION_TRIGGERED'
  )),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb,
  link text,
  read boolean DEFAULT false NOT NULL,
  read_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- 5. Add user_mentions table if missing
CREATE TABLE IF NOT EXISTS user_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  comment_id uuid NOT NULL REFERENCES ticket_comments(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now() NOT NULL,
  UNIQUE(comment_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_mentions_comment ON user_mentions(comment_id);
CREATE INDEX IF NOT EXISTS idx_user_mentions_user ON user_mentions(mentioned_user_id);

-- 6. Add ticket_watchers table if missing
CREATE TABLE IF NOT EXISTS ticket_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now() NOT NULL,
  UNIQUE(ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_watchers_ticket ON ticket_watchers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_watchers_user ON ticket_watchers(user_id);

-- 7. Add ticketAssets linking table for serial/hostname lookup (if not exists)
CREATE TABLE IF NOT EXISTS ticket_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  linked_at timestamp DEFAULT now() NOT NULL,
  linked_by uuid REFERENCES users(id),
  notes text,
  UNIQUE(ticket_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_assets_ticket ON ticket_assets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assets_asset ON ticket_assets(asset_id);

-- Add asset lookup columns to tickets for quick reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' 
    AND column_name = 'asset_serial_number'
  ) THEN
    ALTER TABLE tickets ADD COLUMN asset_serial_number TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' 
    AND column_name = 'asset_hostname'
  ) THEN
    ALTER TABLE tickets ADD COLUMN asset_hostname TEXT;
  END IF;
END $$;

-- Create indexes for asset lookups
CREATE INDEX IF NOT EXISTS idx_tickets_asset_serial ON tickets(asset_serial_number) WHERE asset_serial_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_asset_hostname ON tickets(asset_hostname) WHERE asset_hostname IS NOT NULL;

-- Create index for asset lookup by serial/hostname
CREATE INDEX IF NOT EXISTS idx_assets_serial ON assets(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_hostname ON assets(hostname) WHERE hostname IS NOT NULL;

SELECT 'Database fixes applied successfully' AS status;
