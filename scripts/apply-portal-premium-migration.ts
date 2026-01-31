import { config } from 'dotenv';
import { resolve } from 'path';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function applyMigration() {
  console.log('Applying Portal Premium migration (Phase 4.1)...\n');

  const statements = [
    // Enums
    `DO $$ BEGIN
      CREATE TYPE "asset_type" AS ENUM (
        'AP','SWITCH','FIREWALL','CAMERA','NVR','SERVER','ISP_CIRCUIT','OTHER'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,
    `DO $$ BEGIN
      CREATE TYPE "asset_status" AS ENUM ('ACTIVE','RETIRED','MAINTENANCE');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,
    `DO $$ BEGIN
      CREATE TYPE "notice_type" AS ENUM ('MAINTENANCE','INCIDENT','KNOWN_ISSUE');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,
    `DO $$ BEGIN
      CREATE TYPE "notice_severity" AS ENUM ('INFO','WARN','CRITICAL');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,
    `DO $$ BEGIN
      CREATE TYPE "export_request_status" AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    // request_types
    `CREATE TABLE IF NOT EXISTS "request_types" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "slug" text NOT NULL,
      "description" text,
      "category" ticket_category DEFAULT 'SERVICE_REQUEST' NOT NULL,
      "default_priority" ticket_priority DEFAULT 'P3' NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "form_schema" jsonb,
      "required_attachments" boolean DEFAULT false NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      UNIQUE("org_id", "slug")
    )`,

    // sites
    `CREATE TABLE IF NOT EXISTS "sites" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "slug" text NOT NULL,
      "address" text,
      "timezone" text,
      "notes" text,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      UNIQUE("org_id", "slug")
    )`,

    // areas
    `CREATE TABLE IF NOT EXISTS "areas" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "site_id" uuid NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "floor" text,
      "notes" text,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      UNIQUE("site_id", "name")
    )`,

    // assets
    `CREATE TABLE IF NOT EXISTS "assets" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "site_id" uuid REFERENCES "sites"("id") ON DELETE SET NULL,
      "area_id" uuid REFERENCES "areas"("id") ON DELETE SET NULL,
      "type" asset_type DEFAULT 'OTHER' NOT NULL,
      "name" text NOT NULL,
      "hostname" text,
      "serial_number" text,
      "model" text,
      "vendor" text,
      "ip_address" text,
      "mac_address" text,
      "tags" jsonb,
      "notes" text,
      "status" asset_status DEFAULT 'ACTIVE' NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )`,

    // memberships extensions
    `ALTER TABLE "memberships"
      ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL,
      ADD COLUMN IF NOT EXISTS "deactivated_at" timestamp`,

    // tickets extensions
    `ALTER TABLE "tickets"
      ADD COLUMN IF NOT EXISTS "request_type_id" uuid REFERENCES "request_types"("id") ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "request_payload" jsonb,
      ADD COLUMN IF NOT EXISTS "site_id" uuid REFERENCES "sites"("id") ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "area_id" uuid REFERENCES "areas"("id") ON DELETE SET NULL`,

    // ticket_assets
    `CREATE TABLE IF NOT EXISTS "ticket_assets" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "ticket_id" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
      "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
      "created_at" timestamp DEFAULT now() NOT NULL,
      UNIQUE("ticket_id", "asset_id")
    )`,

    // notices
    `CREATE TABLE IF NOT EXISTS "notices" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "site_id" uuid REFERENCES "sites"("id") ON DELETE SET NULL,
      "type" notice_type DEFAULT 'MAINTENANCE' NOT NULL,
      "title" text NOT NULL,
      "body" text NOT NULL,
      "starts_at" timestamp,
      "ends_at" timestamp,
      "is_active" boolean DEFAULT true NOT NULL,
      "severity" notice_severity DEFAULT 'INFO' NOT NULL,
      "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )`,

    // export_requests
    `CREATE TABLE IF NOT EXISTS "export_requests" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "requested_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "status" export_request_status DEFAULT 'PENDING' NOT NULL,
      "job_id" text,
      "filename" text,
      "blob_pathname" text,
      "storage_key" text,
      "expires_at" timestamp,
      "completed_at" timestamp,
      "error" text,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )`,

    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_request_types_org_id ON request_types(org_id)`,
    `CREATE INDEX IF NOT EXISTS idx_request_types_active ON request_types(org_id, is_active)`,
    `CREATE INDEX IF NOT EXISTS idx_sites_org_id ON sites(org_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sites_active ON sites(org_id, is_active)`,
    `CREATE INDEX IF NOT EXISTS idx_areas_site_id ON areas(site_id)`,
    `CREATE INDEX IF NOT EXISTS idx_assets_org_id ON assets(org_id)`,
    `DO $$ BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'assets' AND column_name = 'site_id'
      ) THEN
        CREATE INDEX IF NOT EXISTS idx_assets_site_id ON assets(site_id);
      END IF;
    END $$;`,
    `DO $$ BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'assets' AND column_name = 'area_id'
      ) THEN
        CREATE INDEX IF NOT EXISTS idx_assets_area_id ON assets(area_id);
      END IF;
    END $$;`,
    `CREATE INDEX IF NOT EXISTS idx_ticket_assets_ticket_id ON ticket_assets(ticket_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ticket_assets_asset_id ON ticket_assets(asset_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notices_org_id ON notices(org_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notices_site_id ON notices(site_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notices_active ON notices(org_id, is_active)`,
    `CREATE INDEX IF NOT EXISTS idx_export_requests_org_id ON export_requests(org_id)`,
    `CREATE INDEX IF NOT EXISTS idx_export_requests_status ON export_requests(status)`,
  ];

  for (const statement of statements) {
    try {
      await db.execute(sql.raw(statement));
      console.log(`✓ ${statement.split('\n')[0].slice(0, 60)}...`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error?.message?.includes('already exists') || error?.code === '42710' || error?.code === '42P07') {
        console.log(`⊘ Skipped (already exists): ${statement.split('\n')[0].slice(0, 60)}...`);
      } else {
        console.error(`✗ Failed: ${statement.split('\n')[0].slice(0, 60)}...`);
        console.error(error);
        throw error;
      }
    }
  }

  console.log('\n✅ Portal Premium migration applied successfully!');
  process.exit(0);
}

applyMigration().catch((error) => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
