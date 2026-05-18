-- Create incidents table
CREATE TABLE IF NOT EXISTS "incidents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "status" text NOT NULL DEFAULT 'investigating',
  "severity" text NOT NULL DEFAULT 'minor',
  "message" text NOT NULL,
  "services_affected" text[],
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create incident_updates table
CREATE TABLE IF NOT EXISTS "incident_updates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "incident_id" uuid NOT NULL REFERENCES "incidents"("id") ON DELETE CASCADE,
  "status" text NOT NULL,
  "message" text NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_incidents_org" ON "incidents" ("org_id");
CREATE INDEX IF NOT EXISTS "idx_incidents_status" ON "incidents" ("status");
CREATE INDEX IF NOT EXISTS "idx_incident_updates_incident" ON "incident_updates" ("incident_id");

-- Add comments
COMMENT ON TABLE "incidents" IS 'Service incidents for public status page';
COMMENT ON TABLE "incident_updates" IS 'Status updates for incidents';
