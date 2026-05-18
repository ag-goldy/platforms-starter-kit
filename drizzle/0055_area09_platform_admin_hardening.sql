ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "platform_region" text DEFAULT 'us' NOT NULL;

ALTER TABLE "platform_admins"
  ADD COLUMN IF NOT EXISTS "ip_allowlist" jsonb;
