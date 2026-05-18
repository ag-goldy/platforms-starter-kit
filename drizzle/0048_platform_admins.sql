-- Platform Admins - Separate from tenant users
-- This table is for Atlas platform administrators only
-- Tenant users remain in the 'users' table

CREATE TABLE IF NOT EXISTS platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'ADMIN', -- 'ADMIN', 'SUPER_ADMIN', 'SUPPORT'
  is_active BOOLEAN NOT NULL DEFAULT true,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  two_factor_secret TEXT,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_platform_admins_email ON platform_admins(email);
CREATE INDEX IF NOT EXISTS idx_platform_admins_active ON platform_admins(is_active);

-- Insert default admin (will be seeded separately)
-- Note: Platform admins are NOT in the users table
