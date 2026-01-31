-- Phase 3.4.2: Per-Org Storage Quotas
-- Add storage quota tracking to organizations

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "storage_quota_bytes" BIGINT DEFAULT 10737418240; -- Default 10GB
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "storage_used_bytes" BIGINT DEFAULT 0;

-- Create index for efficient quota queries
CREATE INDEX IF NOT EXISTS idx_organizations_storage_quota ON organizations(storage_quota_bytes, storage_used_bytes);

-- Calculate initial storage usage from existing attachments
UPDATE "organizations" 
SET "storage_used_bytes" = COALESCE(
  (SELECT SUM("size") FROM "attachments" WHERE "attachments"."org_id" = "organizations"."id"),
  0
);

