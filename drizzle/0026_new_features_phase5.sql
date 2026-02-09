-- Phase 5: New Advanced Features
-- CSAT, Time Tracking, Webhooks, Bulk Operations, Scheduled Tickets

-- ============================================
-- CSAT (Customer Satisfaction) System
-- ============================================
CREATE TABLE csat_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    requester_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Rating: 1-5 stars or 1-10 score
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    -- Optional detailed feedback
    comment TEXT,
    -- Survey status
    sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMP,
    -- Reminder tracking
    reminder_count INTEGER DEFAULT 0,
    last_reminder_at TIMESTAMP,
    -- Token for secure survey link
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_csat_surveys_ticket ON csat_surveys(ticket_id);
CREATE INDEX idx_csat_surveys_org ON csat_surveys(org_id);
CREATE INDEX idx_csat_surveys_token ON csat_surveys(token_hash);
CREATE INDEX idx_csat_surveys_responded_at ON csat_surveys(responded_at) WHERE responded_at IS NULL;

-- CSAT analytics table (aggregated stats per org)
CREATE TABLE csat_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    -- Overall stats
    total_sent INTEGER DEFAULT 0,
    total_responses INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2),
    -- Rating distribution
    rating_1_count INTEGER DEFAULT 0,
    rating_2_count INTEGER DEFAULT 0,
    rating_3_count INTEGER DEFAULT 0,
    rating_4_count INTEGER DEFAULT 0,
    rating_5_count INTEGER DEFAULT 0,
    -- Time-based stats
    last_30_days_avg DECIMAL(3,2),
    last_90_days_avg DECIMAL(3,2),
    -- Response rate
    response_rate DECIMAL(5,2), -- percentage
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- Time Tracking
-- ============================================
CREATE TABLE time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Time tracking
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    duration_minutes INTEGER, -- calculated when ended
    -- Manual entry support
    is_manual_entry BOOLEAN DEFAULT FALSE,
    manual_date DATE, -- for manual entries, the date worked
    -- Description of work
    description TEXT,
    -- Billing
    is_billable BOOLEAN DEFAULT TRUE,
    hourly_rate DECIMAL(10,2), -- override default rate
    billed_amount DECIMAL(10,2), -- calculated
    -- Invoice linkage
    invoice_id UUID, -- will reference invoices table if created
    invoiced_at TIMESTAMP,
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_time_entries_ticket ON time_entries(ticket_id);
CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_org ON time_entries(org_id);
CREATE INDEX idx_time_entries_date ON time_entries(started_at);
CREATE INDEX idx_time_entries_billable ON time_entries(ticket_id, is_billable, invoiced_at) WHERE is_billable = TRUE AND invoiced_at IS NULL;

-- Time tracking settings per org
CREATE TABLE time_tracking_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT FALSE,
    default_hourly_rate DECIMAL(10,2),
    require_description BOOLEAN DEFAULT TRUE,
    minimum_entry_minutes INTEGER DEFAULT 5,
    round_to_minutes INTEGER DEFAULT 15, -- round up to nearest 15 min
    allow_manual_entry BOOLEAN DEFAULT TRUE,
    auto_pause_on_status BOOLEAN DEFAULT TRUE, -- auto pause when ticket resolved
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Active timers (for currently running timers)
CREATE TABLE active_timers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_resumed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    total_paused_minutes INTEGER DEFAULT 0,
    description TEXT,
    is_billable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_active_timers_user ON active_timers(user_id);

-- ============================================
-- Webhook System
-- ============================================
CREATE TYPE webhook_event AS ENUM (
    'ticket.created',
    'ticket.updated',
    'ticket.status_changed',
    'ticket.assigned',
    'ticket.commented',
    'ticket.resolved',
    'ticket.closed',
    'ticket.reopened',
    'user.created',
    'user.updated',
    'organization.updated',
    'sla.warning',
    'sla.breached'
);

CREATE TYPE webhook_status AS ENUM ('active', 'inactive', 'failing');

CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT, -- for HMAC signature
    events webhook_event[] NOT NULL,
    status webhook_status DEFAULT 'active',
    -- Filtering
    filter_conditions JSONB, -- optional filters (e.g., only P1 tickets)
    -- Headers
    custom_headers JSONB,
    -- Retry config
    max_retries INTEGER DEFAULT 3,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    last_error_at TIMESTAMP,
    -- Success tracking
    last_success_at TIMESTAMP,
    total_deliveries INTEGER DEFAULT 0,
    total_failures INTEGER DEFAULT 0,
    -- Metadata
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhooks_org ON webhooks(org_id);
CREATE INDEX idx_webhooks_status ON webhooks(status);

-- Webhook delivery log
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event webhook_event NOT NULL,
    payload JSONB NOT NULL,
    -- Request/Response
    request_headers JSONB,
    request_body TEXT,
    response_status INTEGER,
    response_body TEXT,
    response_headers JSONB,
    -- Timing
    attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    -- Result
    success BOOLEAN NOT NULL,
    error_message TEXT,
    -- Retry info
    retry_number INTEGER DEFAULT 0,
    will_retry BOOLEAN DEFAULT FALSE,
    next_retry_at TIMESTAMP
);

CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_event ON webhook_deliveries(event);
CREATE INDEX idx_webhook_deliveries_attempted ON webhook_deliveries(attempted_at);
CREATE INDEX idx_webhook_deliveries_success ON webhook_deliveries(success, will_retry) WHERE success = FALSE AND will_retry = TRUE;

-- ============================================
-- Scheduled Tickets (Future/Timed Tickets)
-- ============================================
CREATE TYPE scheduled_ticket_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

CREATE TABLE scheduled_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Schedule
    scheduled_for TIMESTAMP NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    processed_at TIMESTAMP,
    -- Ticket template data
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    priority ticket_priority DEFAULT 'P3',
    category ticket_category DEFAULT 'SERVICE_REQUEST',
    requester_id UUID REFERENCES users(id) ON DELETE SET NULL,
    requester_email TEXT,
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
    -- Additional data
    cc_emails TEXT[],
    tags TEXT[],
    custom_fields JSONB,
    -- Recurrence (optional)
    recurrence_pattern TEXT, -- cron-like or 'daily', 'weekly', 'monthly'
    recurrence_end_date TIMESTAMP,
    parent_schedule_id UUID REFERENCES scheduled_tickets(id) ON DELETE SET NULL, -- for recurring instances
    -- Status
    status scheduled_ticket_status DEFAULT 'pending',
    error_message TEXT,
    created_ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduled_tickets_org ON scheduled_tickets(org_id);
CREATE INDEX idx_scheduled_tickets_status ON scheduled_tickets(status);
CREATE INDEX idx_scheduled_tickets_scheduled_for ON scheduled_tickets(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_scheduled_tickets_pending ON scheduled_tickets(scheduled_for, status) WHERE status = 'pending';

-- ============================================
-- Dashboard Widgets (User-customizable dashboards)
-- ============================================
CREATE TYPE widget_type AS ENUM (
    'ticket_count',
    'sla_compliance',
    'recent_tickets',
    'assigned_to_me',
    'unassigned_tickets',
    'csat_score',
    'time_tracked',
    'activity_feed',
    'priority_breakdown',
    'status_breakdown'
);

CREATE TABLE dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- null = personal across all orgs
    -- Widget config
    type widget_type NOT NULL,
    title TEXT,
    config JSONB DEFAULT '{}', -- widget-specific config
    -- Layout
    position_x INTEGER NOT NULL DEFAULT 0,
    position_y INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 2, -- grid columns (1-4)
    height INTEGER NOT NULL DEFAULT 2, -- grid rows
    -- Display
    refresh_interval_seconds INTEGER DEFAULT 300, -- 5 min default
    is_visible BOOLEAN DEFAULT TRUE,
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dashboard_widgets_user ON dashboard_widgets(user_id);
CREATE INDEX idx_dashboard_widgets_visible ON dashboard_widgets(user_id, is_visible);

-- ============================================
-- Bulk Operations Log
-- ============================================
CREATE TYPE bulk_operation_type AS ENUM (
    'assign',
    'status_change',
    'priority_change',
    'add_tags',
    'remove_tags',
    'merge',
    'close',
    'delete'
);

CREATE TYPE bulk_operation_status AS ENUM ('pending', 'running', 'completed', 'failed', 'partial');

CREATE TABLE bulk_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Operation details
    type bulk_operation_type NOT NULL,
    status bulk_operation_status DEFAULT 'pending',
    -- Target tickets
    ticket_ids UUID[] NOT NULL,
    ticket_count INTEGER NOT NULL,
    -- Operation data
    data JSONB NOT NULL, -- { assigneeId: '...', status: '...', etc }
    -- Results
    processed_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    errors JSONB, -- [{ ticketId: '...', error: '...' }]
    -- Timing
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bulk_operations_org ON bulk_operations(org_id);
CREATE INDEX idx_bulk_operations_user ON bulk_operations(user_id);
CREATE INDEX idx_bulk_operations_status ON bulk_operations(status);

-- ============================================
-- Triggers for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_csat_surveys_updated_at BEFORE UPDATE ON csat_surveys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_csat_analytics_updated_at BEFORE UPDATE ON csat_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_tracking_settings_updated_at BEFORE UPDATE ON time_tracking_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_tickets_updated_at BEFORE UPDATE ON scheduled_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_widgets_updated_at BEFORE UPDATE ON dashboard_widgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
