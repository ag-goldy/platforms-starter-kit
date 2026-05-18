-- Create retention_policies table
CREATE TABLE IF NOT EXISTS "retention_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "data_type" text NOT NULL,
  "retention_days" integer NOT NULL,
  "auto_delete" boolean DEFAULT false,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "updated_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE ("org_id", "data_type")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_retention_org" ON "retention_policies" ("org_id");
CREATE INDEX IF NOT EXISTS "idx_retention_type" ON "retention_policies" ("data_type");

-- Insert default retention policies for existing orgs
INSERT INTO "retention_policies" ("org_id", "data_type", "retention_days", "auto_delete")
SELECT DISTINCT "id", 'tickets', 730, false FROM "organizations"
ON CONFLICT DO NOTHING;

INSERT INTO "retention_policies" ("org_id", "data_type", "retention_days", "auto_delete")
SELECT DISTINCT "id", 'audit_logs', 730, false FROM "organizations"
ON CONFLICT DO NOTHING;

INSERT INTO "retention_policies" ("org_id", "data_type", "retention_days", "auto_delete")
SELECT DISTINCT "id", 'ai_chat_logs', 365, false FROM "organizations"
ON CONFLICT DO NOTHING;

INSERT INTO "retention_policies" ("org_id", "data_type", "retention_days", "auto_delete")
SELECT DISTINCT "id", 'attachments', 1095, false FROM "organizations"
ON CONFLICT DO NOTHING;
