-- Add archive functionality to assets table
ALTER TABLE assets 
ADD COLUMN archived BOOLEAN DEFAULT FALSE,
ADD COLUMN archived_at TIMESTAMP,
ADD COLUMN archived_by UUID REFERENCES users(id);

-- Create index for archived filter performance
CREATE INDEX idx_assets_archived ON assets(archived);
CREATE INDEX idx_assets_archived_org ON assets(archived, org_id) WHERE org_id IS NOT NULL;
