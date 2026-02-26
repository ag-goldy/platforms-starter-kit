-- ============================================
-- Phase 1: Comprehensive Improvements Migration
-- ============================================

-- Widget Configuration for Organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS widget_config jsonb DEFAULT '{
  "enabled": ["tickets", "kb", "health", "quick_actions"],
  "layout": "grid",
  "customOrder": ["tickets", "kb", "health", "quick_actions"]
}'::jsonb;

-- Time Tracking
CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at timestamp NOT NULL DEFAULT NOW(),
  ended_at timestamp,
  duration_minutes integer,
  description text,
  is_billable boolean DEFAULT true,
  hourly_rate decimal(10, 2),
  source text DEFAULT 'manual', -- 'manual', 'timer', 'automatic'
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_ticket ON time_entries(ticket_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(started_at);

-- Ticket Subtasks
CREATE TABLE IF NOT EXISTS ticket_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text DEFAULT 'todo', -- 'todo', 'in_progress', 'done'
  assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  due_date timestamp,
  sort_order integer DEFAULT 0,
  completed_at timestamp,
  completed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_subtasks_ticket ON ticket_subtasks(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_subtasks_assignee ON ticket_subtasks(assignee_id);

-- Ticket Dependencies (Gantt-style)
CREATE TABLE IF NOT EXISTS ticket_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  depends_on_ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  dependency_type text DEFAULT 'blocks', -- 'blocks', 'blocked_by', 'relates_to'
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT NOW(),
  CONSTRAINT no_self_dependency CHECK (ticket_id != depends_on_ticket_id),
  CONSTRAINT unique_dependency UNIQUE (ticket_id, depends_on_ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_dependencies_ticket ON ticket_dependencies(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_dependencies_depends ON ticket_dependencies(depends_on_ticket_id);

-- Draft Autosave
CREATE TABLE IF NOT EXISTS ticket_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  draft_type text NOT NULL DEFAULT 'comment', -- 'comment', 'internal_note', 'reply'
  content text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  last_saved_at timestamp DEFAULT NOW(),
  created_at timestamp DEFAULT NOW(),
  CONSTRAINT unique_user_ticket_draft UNIQUE (user_id, ticket_id, draft_type)
);

CREATE INDEX IF NOT EXISTS idx_ticket_drafts_user ON ticket_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_drafts_ticket ON ticket_drafts(ticket_id);

-- Collision Detection / Concurrent Editing
CREATE TABLE IF NOT EXISTS ticket_edit_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at timestamp DEFAULT NOW(),
  last_activity_at timestamp DEFAULT NOW(),
  is_active boolean DEFAULT true,
  user_name text,
  user_avatar text
);

CREATE INDEX IF NOT EXISTS idx_edit_sessions_ticket ON ticket_edit_sessions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_edit_sessions_active ON ticket_edit_sessions(ticket_id, is_active) WHERE is_active = true;

-- PII Detection Settings
CREATE TABLE IF NOT EXISTS pii_detection_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  pattern_name text NOT NULL, -- 'credit_card', 'ssn', 'api_key', etc.
  pattern_regex text NOT NULL,
  severity text DEFAULT 'high', -- 'low', 'medium', 'high', 'critical'
  action text DEFAULT 'mask', -- 'mask', 'block', 'warn', 'flag'
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pii_rules_org ON pii_detection_rules(org_id);

-- PII Detections Log
CREATE TABLE IF NOT EXISTS pii_detections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES ticket_comments(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES pii_detection_rules(id) ON DELETE SET NULL,
  detected_text text,
  masked_text text,
  severity text,
  action_taken text,
  detected_at timestamp DEFAULT NOW(),
  detected_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Enhanced Security Settings
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS security_settings jsonb DEFAULT '{
  "ipAllowlist": false,
  "sessionTimeout": 1440,
  "passwordPolicy": {
    "minLength": 8,
    "requireComplexity": true,
    "expiryDays": null
  },
  "mfaRequired": false,
  "ssoEnabled": false,
  "dataLossPrevention": true
}'::jsonb;

-- Article Analytics
CREATE TABLE IF NOT EXISTS kb_article_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  session_id text,
  action text NOT NULL, -- 'view', 'search_found', 'helpful', 'not_helpful', 'share', 'print'
  search_query text,
  referrer text,
  user_agent text,
  ip_address text,
  created_at timestamp DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_analytics_article ON kb_article_analytics(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_analytics_action ON kb_article_analytics(action);
CREATE INDEX IF NOT EXISTS idx_kb_analytics_date ON kb_article_analytics(created_at);

-- Article Feedback Enhancement
ALTER TABLE kb_article_feedback ADD COLUMN IF NOT EXISTS feedback_category text; -- 'outdated', 'inaccurate', 'unclear', 'missing_info'
ALTER TABLE kb_article_feedback ADD COLUMN IF NOT EXISTS user_intent text; -- what user was looking for

-- Webhook Subscriptions
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  secret text, -- for HMAC signature
  events text[] NOT NULL, -- ['ticket.created', 'ticket.updated', etc.]
  is_active boolean DEFAULT true,
  retry_count integer DEFAULT 3,
  timeout_seconds integer DEFAULT 30,
  custom_headers jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW(),
  last_triggered_at timestamp,
  last_error text,
  last_success_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhook_subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhook_subscriptions(org_id, is_active) WHERE is_active = true;

-- Webhook Delivery Log
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  error_message text,
  attempt_number integer DEFAULT 1,
  duration_ms integer,
  created_at timestamp DEFAULT NOW(),
  completed_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_date ON webhook_deliveries(created_at);

-- Integration Configurations
CREATE TABLE IF NOT EXISTS integration_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL, -- 'slack', 'teams', 'jira', 'github', 'salesforce'
  config jsonb NOT NULL,
  is_active boolean DEFAULT true,
  credentials_encrypted text, -- encrypted API keys/tokens
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW(),
  last_sync_at timestamp,
  last_error text,
  CONSTRAINT unique_org_provider UNIQUE (org_id, provider)
);

-- Agent Performance Metrics
CREATE TABLE IF NOT EXISTS agent_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  tickets_assigned integer DEFAULT 0,
  tickets_resolved integer DEFAULT 0,
  tickets_reopened integer DEFAULT 0,
  avg_first_response_minutes integer,
  avg_resolution_minutes integer,
  avg_csat_rating decimal(3, 2),
  total_time_tracked_minutes integer DEFAULT 0,
  internal_notes_count integer DEFAULT 0,
  customer_replies_count integer DEFAULT 0,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW(),
  CONSTRAINT unique_user_date UNIQUE (user_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_user ON agent_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_org_date ON agent_metrics(org_id, metric_date);

-- Scheduled Reports
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  report_type text NOT NULL, -- 'ticket_volume', 'agent_performance', 'sla_compliance', 'custom'
  config jsonb NOT NULL, -- report configuration
  schedule text NOT NULL, -- cron expression
  recipients text[] NOT NULL,
  format text DEFAULT 'pdf', -- 'pdf', 'csv', 'xlsx'
  last_run_at timestamp,
  next_run_at timestamp,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

-- Visual Workflow Builder State
CREATE TABLE IF NOT EXISTS workflow_visual_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  nodes jsonb NOT NULL, -- workflow nodes
  edges jsonb NOT NULL, -- connections
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

-- Optimized Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_tickets_org_status_priority ON tickets(org_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_tickets_org_assignee ON tickets(org_id, assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_org_created ON tickets(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status_priority ON tickets(status, priority) WHERE status IN ('NEW', 'OPEN', 'IN_PROGRESS');
CREATE INDEX IF NOT EXISTS idx_comments_ticket_created ON ticket_comments(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_action ON audit_logs(org_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_org_status ON kb_articles(org_id, status);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_tickets_search ON tickets USING gin(to_tsvector('english', subject || ' ' || COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_kb_articles_search ON kb_articles USING gin(to_tsvector('english', title || ' ' || COALESCE(content, '')));

-- Update timestamps trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ticket_subtasks_updated_at BEFORE UPDATE ON ticket_subtasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pii_rules_updated_at BEFORE UPDATE ON pii_detection_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_webhook_subscriptions_updated_at BEFORE UPDATE ON webhook_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integration_configs_updated_at BEFORE UPDATE ON integration_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agent_metrics_updated_at BEFORE UPDATE ON agent_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scheduled_reports_updated_at BEFORE UPDATE ON scheduled_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
