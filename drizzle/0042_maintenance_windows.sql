-- Create maintenance_windows table
CREATE TABLE IF NOT EXISTS "maintenance_windows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "scheduled_start" timestamp NOT NULL,
  "scheduled_end" timestamp NOT NULL,
  "services_affected" text[],
  "notify_before_minutes" integer DEFAULT 60,
  "status" text DEFAULT 'scheduled' NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_maintenance_org" ON "maintenance_windows" ("org_id");
CREATE INDEX IF NOT EXISTS "idx_maintenance_status" ON "maintenance_windows" ("status");
CREATE INDEX IF NOT EXISTS "idx_maintenance_dates" ON "maintenance_windows" ("scheduled_start", "scheduled_end");
