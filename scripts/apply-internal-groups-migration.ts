import { config } from 'dotenv';
import { resolve } from 'path';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function applyMigration() {
  console.log('Applying internal groups migration...\n');

  const statements = [
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'internal_group_role') THEN
        CREATE TYPE "internal_group_role" AS ENUM ('ADMIN', 'MEMBER');
      END IF;
    END $$;`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'internal_group_scope') THEN
        CREATE TYPE "internal_group_scope" AS ENUM ('PLATFORM', 'ORG');
      END IF;
    END $$;`,
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'internal_group_role_type') THEN
        CREATE TYPE "internal_group_role_type" AS ENUM (
          'PLATFORM_SUPER_ADMIN',
          'PLATFORM_ADMIN',
          'SECURITY_ADMIN',
          'COMPLIANCE_AUDITOR',
          'BILLING_ADMIN',
          'INTEGRATION_ADMIN',
          'ORG_ADMIN',
          'SUPPORT_OPS_ADMIN',
          'TEAM_QUEUE_MANAGER',
          'SUPERVISOR',
          'AGENT'
        );
      END IF;
    END $$;`,
    `CREATE TABLE IF NOT EXISTS "internal_groups" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "description" text,
      "scope" internal_group_scope NOT NULL DEFAULT 'PLATFORM',
      "org_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
      "role_type" internal_group_role_type NOT NULL DEFAULT 'PLATFORM_ADMIN',
      "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );`,
    `ALTER TABLE "internal_groups" ADD COLUMN IF NOT EXISTS "scope" internal_group_scope NOT NULL DEFAULT 'PLATFORM';`,
    `ALTER TABLE "internal_groups" ADD COLUMN IF NOT EXISTS "org_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE;`,
    `ALTER TABLE "internal_groups" ADD COLUMN IF NOT EXISTS "role_type" internal_group_role_type NOT NULL DEFAULT 'PLATFORM_ADMIN';`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "internal_groups_name_unique" ON "internal_groups" ("name");`,
    `CREATE TABLE IF NOT EXISTS "internal_group_memberships" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "group_id" uuid NOT NULL REFERENCES "internal_groups"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "role" internal_group_role NOT NULL DEFAULT 'MEMBER',
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "internal_group_memberships_group_user_unique" ON "internal_group_memberships" ("group_id", "user_id");`,
  ];

  for (const statement of statements) {
    try {
      await db.execute(sql.raw(statement));
      console.log(`✓ ${statement.substring(0, 60)}...`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log(`⊘ Skipped (already exists): ${statement.substring(0, 60)}...`);
      } else {
        console.error(`✗ Failed: ${statement}`);
        console.error(error);
        throw error;
      }
    }
  }

  console.log('\n✅ Migration applied successfully!');
  process.exit(0);
}

applyMigration().catch((error) => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
