-- Performance Indexes for 3-Tier Architecture
-- Created: 2025-02-25
-- 
-- These indexes optimize the most common query patterns.
-- Using CREATE INDEX CONCURRENTLY to avoid locking tables.
-- Run this during a low-traffic period.

-- Ticket queries (most common)
-- Supports: ticket list filtering by status, assignee dashboard, priority sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_org_status_created 
  ON tickets(org_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_org_assignee 
  ON tickets(org_id, assignee_id) 
  WHERE assignee_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_org_priority 
  ON tickets(org_id, priority);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_org_requester 
  ON tickets(org_id, requester_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_sla_status 
  ON tickets(sla_status) 
  WHERE sla_status IN ('warning', 'breached');

-- Comment queries
-- Supports: ticket detail view (comments ordered by date)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_ticket_created 
  ON ticket_comments(ticket_id, created_at DESC);

-- User/membership lookups
-- Supports: login, org switching, permission checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memberships_user_org 
  ON memberships(user_id, org_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memberships_org_role 
  ON memberships(org_id, role);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
  ON users(email);

-- KB article search
-- Supports: KB listing by org and status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kb_articles_org_status 
  ON kb_articles(org_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kb_articles_category 
  ON kb_articles(category_id) 
  WHERE category_id IS NOT NULL;

-- Audit log queries
-- Supports: audit log viewer, compliance reports
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_org_created 
  ON audit_logs(org_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_user_created 
  ON audit_logs(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_action 
  ON audit_logs(action, created_at DESC);

-- Service monitoring
-- Supports: service status pages, uptime calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_org 
  ON services(org_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_zabbix 
  ON services(zabbix_host_id) 
  WHERE zabbix_host_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monitoring_history_service 
  ON service_monitoring_history(service_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monitoring_history_service_time 
  ON service_monitoring_history(service_id, checked_at DESC);

-- Organization queries
-- Supports: org lookup by slug, internal admin queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_slug 
  ON organizations(slug);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_is_internal 
  ON organizations(is_internal) 
  WHERE is_internal = false;

-- Session queries
-- Supports: session validation, cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user 
  ON sessions(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expires 
  ON sessions(expires_at) 
  WHERE expires_at < NOW() + INTERVAL '7 days';

-- Notification queries
-- Supports: notification inbox, unread counts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread 
  ON notifications(user_id, read_at) 
  WHERE read_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_created 
  ON notifications(user_id, created_at DESC);

-- Export queries
-- Supports: export listing, cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exports_org_status 
  ON exports(org_id, status, created_at DESC);

-- Failed jobs (if keeping PostgreSQL as fallback)
-- Supports: dead letter queue monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_failed_jobs_type 
  ON failed_jobs(type, failed_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_failed_jobs_retry 
  ON failed_jobs(retry_at) 
  WHERE retry_at IS NOT NULL AND retry_at <= NOW();

-- SLA policy queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sla_policies_org 
  ON sla_policies(org_id);

-- Tag queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_tags_ticket 
  ON ticket_tags(ticket_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_tags_tag 
  ON ticket_tags(tag_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_org 
  ON tags(org_id);

-- Template queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_org 
  ON templates(org_id);

-- File/attachment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attachments_ticket 
  ON attachments(ticket_id);

-- Comment reactions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comment_reactions_comment 
  ON comment_reactions(comment_id);

-- Subscription queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_subscriptions_user 
  ON ticket_subscriptions(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_subscriptions_ticket 
  ON ticket_subscriptions(ticket_id);

-- Magic link token queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_magic_links_token 
  ON magic_links(token_hash);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_magic_links_expires 
  ON magic_links(expires_at) 
  WHERE expires_at > NOW();

-- Record the migration
INSERT INTO drizzle_migrations (hash, created_at) 
VALUES ('028_performance_indexes', NOW())
ON CONFLICT DO NOTHING;
