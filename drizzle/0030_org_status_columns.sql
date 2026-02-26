-- Add organization status columns for disable/soft-delete functionality

-- Add isActive column with default true
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;

-- Add disabledAt timestamp
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP;

-- Add disabledBy (user ID who disabled)
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS disabled_by TEXT;

-- Add deletedAt timestamp for soft delete
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create index for active organizations lookup
CREATE INDEX IF NOT EXISTS idx_organizations_is_active 
ON organizations(is_active);

-- Create index for subdomain + active lookup (used by middleware)
CREATE INDEX IF NOT EXISTS idx_organizations_subdomain_active 
ON organizations(subdomain, is_active) 
WHERE deleted_at IS NULL;

-- Create partial index for disabled organizations
CREATE INDEX IF NOT EXISTS idx_organizations_disabled 
ON organizations(disabled_at) 
WHERE is_active = FALSE AND deleted_at IS NULL;
