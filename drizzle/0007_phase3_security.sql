-- Phase 3.1: Multi-Tenant Security Hardening
-- Composite indexes for tenant-scoped queries

-- Tickets table indexes
CREATE INDEX IF NOT EXISTS idx_tickets_org_created ON tickets(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_org_status ON tickets(org_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_org_assignee ON tickets(org_id, assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_org_priority ON tickets(org_id, priority);

-- Comments table indexes
CREATE INDEX IF NOT EXISTS idx_comments_ticket_created ON ticket_comments(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_org_ticket ON ticket_comments(ticket_id, org_id);

-- Attachments table indexes
CREATE INDEX IF NOT EXISTS idx_attachments_ticket_org ON attachments(ticket_id, org_id);
CREATE INDEX IF NOT EXISTS idx_attachments_org_created ON attachments(org_id, created_at);

-- Audit logs table indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ticket_org ON audit_logs(ticket_id, org_id);

-- Tag assignments table indexes
CREATE INDEX IF NOT EXISTS idx_tag_assignments_ticket_org ON ticket_tag_assignments(ticket_id, org_id);

-- Memberships table indexes (for org member lookups)
CREATE INDEX IF NOT EXISTS idx_memberships_user_org ON memberships(user_id, org_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_user ON memberships(org_id, user_id);

