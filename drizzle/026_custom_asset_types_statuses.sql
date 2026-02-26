-- Migration: Add custom asset types, statuses, and access URLs
-- Created: 2026-02-10

-- Create org_asset_types table
CREATE TABLE IF NOT EXISTS "org_asset_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "label" text NOT NULL,
  "description" text,
  "color" text DEFAULT '#6B7280',
  "icon" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "org_asset_types_org_id_idx" ON "org_asset_types"("org_id");
CREATE INDEX IF NOT EXISTS "org_asset_types_is_active_idx" ON "org_asset_types"("is_active");

-- Create org_asset_statuses table
CREATE TABLE IF NOT EXISTS "org_asset_statuses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "label" text NOT NULL,
  "description" text,
  "color" text DEFAULT '#6B7280',
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "org_asset_statuses_org_id_idx" ON "org_asset_statuses"("org_id");
CREATE INDEX IF NOT EXISTS "org_asset_statuses_is_active_idx" ON "org_asset_statuses"("is_active");

-- Add access_urls column to assets table
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "access_urls" jsonb;

-- Note: Changing type and status from enum to text requires data migration
-- First, add new text columns
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "type_text" text DEFAULT 'OTHER' NOT NULL;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "status_text" text DEFAULT 'ACTIVE' NOT NULL;

-- Copy data from enum columns to text columns
UPDATE "assets" SET "type_text" = "type"::text;
UPDATE "assets" SET "status_text" = "status"::text;

-- Drop the old enum columns and rename text columns
ALTER TABLE "assets" DROP COLUMN IF EXISTS "type";
ALTER TABLE "assets" DROP COLUMN IF EXISTS "status";
ALTER TABLE "assets" RENAME COLUMN "type_text" TO "type";
ALTER TABLE "assets" RENAME COLUMN "status_text" TO "status";

-- Add comment explaining the change
COMMENT ON TABLE "org_asset_types" IS 'Custom asset types defined per organization';
COMMENT ON TABLE "org_asset_statuses" IS 'Custom asset statuses defined per organization';
COMMENT ON COLUMN "assets"."access_urls" IS 'Array of {label, url} objects for accessing the asset';
