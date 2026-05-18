-- AI Audit Log Migration
-- Creates table for logging AI interactions

CREATE TABLE IF NOT EXISTS ai_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  interface TEXT NOT NULL, -- 'public', 'customer', 'admin'
  user_query TEXT NOT NULL,
  system_prompt_hash TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  model_used TEXT,
  tokens_used INTEGER,
  response_time_ms INTEGER,
  pii_detected BOOLEAN DEFAULT FALSE,
  pii_types TEXT[],
  was_filtered BOOLEAN DEFAULT FALSE,
  sources_used TEXT[],
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_org_id ON ai_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_user_id ON ai_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_interface ON ai_audit_log(interface);
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_created_at ON ai_audit_log(created_at DESC);

-- Comment for documentation
COMMENT ON TABLE ai_audit_log IS 'Audit log for all AI interactions across the platform';
