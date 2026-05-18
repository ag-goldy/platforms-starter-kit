-- Statuspage.io Integration Migration
-- Creates table for storing Statuspage configuration per organization

CREATE TABLE IF NOT EXISTS statuspage_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL,
  page_id TEXT,
  page_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  auto_sync_services BOOLEAN DEFAULT FALSE,
  auto_create_incidents BOOLEAN DEFAULT FALSE,
  component_mappings JSONB DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Each organization can only have one statuspage config
  CONSTRAINT statuspage_configs_org_id_unique UNIQUE (org_id)
);

-- Create index for faster lookups by org
CREATE INDEX IF NOT EXISTS idx_statuspage_configs_org_id 
  ON statuspage_configs(org_id);

-- Create index for active configs
CREATE INDEX IF NOT EXISTS idx_statuspage_configs_active 
  ON statuspage_configs(is_active) 
  WHERE is_active = TRUE;

-- Add comment for documentation
COMMENT ON TABLE statuspage_configs IS 'Stores Statuspage.io integration configuration per organization';
COMMENT ON COLUMN statuspage_configs.api_key IS 'Statuspage.io OAuth API key';
COMMENT ON COLUMN statuspage_configs.page_id IS 'Statuspage page ID (optional, auto-detected if not set)';
COMMENT ON COLUMN statuspage_configs.component_mappings IS 'JSON mapping of Atlas service IDs to Statuspage component IDs';
