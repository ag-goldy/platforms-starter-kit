-- Create org_quotas table
CREATE TABLE IF NOT EXISTS "org_quotas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "plan" text NOT NULL DEFAULT 'free',
  "max_tickets_per_month" integer NOT NULL DEFAULT 50,
  "max_users" integer NOT NULL DEFAULT 3,
  "max_storage_mb" integer NOT NULL DEFAULT 100,
  "max_ai_queries_per_month" integer NOT NULL DEFAULT 100,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE ("org_id")
);

-- Create org_usage table
CREATE TABLE IF NOT EXISTS "org_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "month" text NOT NULL,
  "tickets_created" integer DEFAULT 0,
  "users_count" integer DEFAULT 0,
  "storage_mb" numeric(10,2) DEFAULT 0,
  "ai_queries" integer DEFAULT 0,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE ("org_id", "month")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_org_quotas_org" ON "org_quotas" ("org_id");
CREATE INDEX IF NOT EXISTS "idx_org_usage_org" ON "org_usage" ("org_id");
CREATE INDEX IF NOT EXISTS "idx_org_usage_month" ON "org_usage" ("month");

-- Insert default quotas for existing orgs
INSERT INTO "org_quotas" ("org_id", "plan", "max_tickets_per_month", "max_users", "max_storage_mb", "max_ai_queries_per_month")
SELECT "id", 'free', 50, 3, 100, 100 FROM "organizations"
ON CONFLICT ("org_id") DO NOTHING;
