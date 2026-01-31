-- Phase 3.6: Automation Rules Engine
-- Create automation_rules table

CREATE TABLE IF NOT EXISTS "automation_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "trigger_on" text NOT NULL CHECK (trigger_on IN ('CREATE', 'UPDATE', 'COMMENT')),
  "conditions" text NOT NULL,
  "actions" text NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON automation_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled ON automation_rules(org_id, enabled, priority) WHERE enabled = true;
