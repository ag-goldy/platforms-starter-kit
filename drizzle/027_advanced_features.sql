-- Migration: Advanced Features (KB versioning, automation, custom fields, etc.)
-- Created: 2026-02-10

-- KB Article Versions
CREATE TABLE IF NOT EXISTS "kb_article_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "article_id" uuid NOT NULL REFERENCES "kb_articles"("id") ON DELETE CASCADE,
  "version_number" integer NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "content_type" text DEFAULT 'markdown' NOT NULL,
  "excerpt" text,
  "category_id" uuid REFERENCES "kb_categories"("id") ON DELETE SET NULL,
  "change_summary" text,
  "created_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("article_id", "version_number")
);

CREATE INDEX IF NOT EXISTS "kb_article_versions_article_id_idx" ON "kb_article_versions"("article_id");
CREATE INDEX IF NOT EXISTS "kb_article_versions_created_at_idx" ON "kb_article_versions"("created_at");

-- KB Article Templates
CREATE TABLE IF NOT EXISTS "kb_article_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "title_template" text,
  "content_template" text NOT NULL,
  "category_id" uuid REFERENCES "kb_categories"("id") ON DELETE SET NULL,
  "default_tags" jsonb DEFAULT '[]'::jsonb,
  "default_visibility" text DEFAULT 'public',
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0,
  "created_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "kb_article_templates_org_id_idx" ON "kb_article_templates"("org_id");
CREATE INDEX IF NOT EXISTS "kb_article_templates_is_active_idx" ON "kb_article_templates"("is_active");

-- Ticket Assignment Rules
CREATE TABLE IF NOT EXISTS "ticket_assignment_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "conditions" jsonb NOT NULL,
  "strategy" text NOT NULL,
  "assignee_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "internal_group_id" uuid REFERENCES "internal_groups"("id") ON DELETE SET NULL,
  "last_assigned_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ticket_assignment_rules_org_id_idx" ON "ticket_assignment_rules"("org_id");
CREATE INDEX IF NOT EXISTS "ticket_assignment_rules_is_active_idx" ON "ticket_assignment_rules"("is_active");

-- Escalation Rules
CREATE TABLE IF NOT EXISTS "escalation_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "trigger_type" text NOT NULL,
  "time_threshold" integer NOT NULL,
  "applicable_priorities" jsonb DEFAULT '["P1", "P2", "P3", "P4"]'::jsonb,
  "applicable_categories" jsonb DEFAULT '["INCIDENT", "SERVICE_REQUEST", "CHANGE_REQUEST"]'::jsonb,
  "actions" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "escalation_rules_org_id_idx" ON "escalation_rules"("org_id");
CREATE INDEX IF NOT EXISTS "escalation_rules_is_active_idx" ON "escalation_rules"("is_active");

-- Maintenance Windows
CREATE TABLE IF NOT EXISTS "maintenance_windows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "starts_at" timestamp NOT NULL,
  "ends_at" timestamp NOT NULL,
  "timezone" text DEFAULT 'UTC' NOT NULL,
  "recurrence_pattern" text,
  "recurrence_end_date" timestamp,
  "affected_service_ids" jsonb DEFAULT '[]'::jsonb,
  "affected_asset_ids" jsonb DEFAULT '[]'::jsonb,
  "auto_create_ticket" boolean DEFAULT true NOT NULL,
  "ticket_template" jsonb,
  "created_ticket_id" uuid REFERENCES "tickets"("id") ON DELETE SET NULL,
  "status" text DEFAULT 'scheduled' NOT NULL,
  "created_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "maintenance_windows_org_id_idx" ON "maintenance_windows"("org_id");
CREATE INDEX IF NOT EXISTS "maintenance_windows_status_idx" ON "maintenance_windows"("status");
CREATE INDEX IF NOT EXISTS "maintenance_windows_starts_at_idx" ON "maintenance_windows"("starts_at");

-- Custom Fields
CREATE TABLE IF NOT EXISTS "custom_fields" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "label" text NOT NULL,
  "description" text,
  "entity_type" text NOT NULL,
  "field_type" text NOT NULL,
  "options" jsonb,
  "is_required" boolean DEFAULT false NOT NULL,
  "validation_regex" text,
  "validation_message" text,
  "min_value" integer,
  "max_value" integer,
  "min_length" integer,
  "max_length" integer,
  "placeholder" text,
  "default_value" text,
  "sort_order" integer DEFAULT 0,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("org_id", "entity_type", "name")
);

CREATE INDEX IF NOT EXISTS "custom_fields_org_id_idx" ON "custom_fields"("org_id");
CREATE INDEX IF NOT EXISTS "custom_fields_entity_type_idx" ON "custom_fields"("entity_type");
CREATE INDEX IF NOT EXISTS "custom_fields_is_active_idx" ON "custom_fields"("is_active");

-- Custom Field Values
CREATE TABLE IF NOT EXISTS "custom_field_values" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "field_id" uuid NOT NULL REFERENCES "custom_fields"("id") ON DELETE CASCADE,
  "entity_id" text NOT NULL,
  "entity_type" text NOT NULL,
  "value" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("field_id", "entity_id")
);

CREATE INDEX IF NOT EXISTS "custom_field_values_entity_idx" ON "custom_field_values"("entity_type", "entity_id");

-- IP Allowlist
CREATE TABLE IF NOT EXISTS "ip_allowlist" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "ip_address" text NOT NULL,
  "scope" text DEFAULT 'organization' NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "last_used_at" timestamp,
  "use_count" integer DEFAULT 0,
  "created_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ip_allowlist_org_id_idx" ON "ip_allowlist"("org_id");
CREATE INDEX IF NOT EXISTS "ip_allowlist_is_active_idx" ON "ip_allowlist"("is_active");
CREATE INDEX IF NOT EXISTS "ip_allowlist_ip_address_idx" ON "ip_allowlist"("ip_address");

-- User Sessions Extended (for session management)
CREATE TABLE IF NOT EXISTS "user_sessions_extended" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "session_token" text NOT NULL UNIQUE,
  "device_type" text,
  "browser" text,
  "os" text,
  "ip_address" text,
  "user_agent" text,
  "location" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "revoked_at" timestamp,
  "revoked_reason" text,
  "last_active_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "user_sessions_extended_user_id_idx" ON "user_sessions_extended"("user_id");
CREATE INDEX IF NOT EXISTS "user_sessions_extended_is_active_idx" ON "user_sessions_extended"("is_active");
CREATE INDEX IF NOT EXISTS "user_sessions_extended_session_token_idx" ON "user_sessions_extended"("session_token");

-- Data Export Requests (GDPR)
CREATE TABLE IF NOT EXISTS "data_export_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "org_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "request_type" text NOT NULL,
  "entity_type" text DEFAULT 'user' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "date_from" timestamp,
  "date_to" timestamp,
  "file_url" text,
  "file_size" integer,
  "expires_at" timestamp,
  "processed_at" timestamp,
  "processed_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "data_export_requests_user_id_idx" ON "data_export_requests"("user_id");
CREATE INDEX IF NOT EXISTS "data_export_requests_status_idx" ON "data_export_requests"("status");

-- Data Retention Policies
CREATE TABLE IF NOT EXISTS "data_retention_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "entity_type" text NOT NULL,
  "retention_days" integer NOT NULL,
  "conditions" jsonb DEFAULT '{}'::jsonb,
  "action" text DEFAULT 'archive' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "last_run_at" timestamp,
  "next_run_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "data_retention_policies_org_id_idx" ON "data_retention_policies"("org_id");
CREATE INDEX IF NOT EXISTS "data_retention_policies_is_active_idx" ON "data_retention_policies"("is_active");

-- Add comments
COMMENT ON TABLE "kb_article_versions" IS 'Stores historical versions of KB articles for versioning support';
COMMENT ON TABLE "kb_article_templates" IS 'Templates for creating standardized KB articles';
COMMENT ON TABLE "ticket_assignment_rules" IS 'Rules for automatic ticket assignment';
COMMENT ON TABLE "escalation_rules" IS 'Rules for automatic ticket escalation';
COMMENT ON TABLE "maintenance_windows" IS 'Scheduled maintenance windows with auto-ticket creation';
COMMENT ON TABLE "custom_fields" IS 'Custom field definitions for tickets, assets, users';
COMMENT ON TABLE "custom_field_values" IS 'Values for custom fields';
COMMENT ON TABLE "ip_allowlist" IS 'IP allowlist for access control';
COMMENT ON TABLE "user_sessions_extended" IS 'Extended session information for management';
COMMENT ON TABLE "data_export_requests" IS 'GDPR data export and deletion requests';
COMMENT ON TABLE "data_retention_policies" IS 'Automated data retention policies';
