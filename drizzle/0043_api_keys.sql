-- Create api_keys table
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "key_hash" text NOT NULL,
  "prefix" text NOT NULL,
  "permissions" text[] DEFAULT '{}',
  "last_used_at" timestamp,
  "expires_at" timestamp,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "is_active" boolean DEFAULT true
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_api_keys_org" ON "api_keys" ("org_id");
CREATE INDEX IF NOT EXISTS "idx_api_keys_prefix" ON "api_keys" ("prefix");
CREATE INDEX IF NOT EXISTS "idx_api_keys_active" ON "api_keys" ("org_id", "is_active");
