import { config } from 'dotenv';
import { resolve } from 'path';
import { db } from '../db';
import { sql } from 'drizzle-orm';

config({ path: resolve(process.cwd(), '.env.local') });

async function applyMigration() {
  console.log('Applying services migration...\n');

  const statements = [
    `CREATE TYPE service_status AS ENUM ('ACTIVE','DEGRADED','OFFLINE')`,
    `DO $$ BEGIN
       CREATE TYPE service_status AS ENUM ('ACTIVE','DEGRADED','OFFLINE');
     EXCEPTION
       WHEN duplicate_object THEN null;
     END $$;`,
    `CREATE TABLE IF NOT EXISTS "services" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "slug" text NOT NULL,
      "description" text,
      "status" service_status NOT NULL DEFAULT 'ACTIVE',
      "is_under_contract" boolean NOT NULL DEFAULT false,
      "business_hours" jsonb,
      "sla_response_hours_p1" integer,
      "sla_response_hours_p2" integer,
      "sla_response_hours_p3" integer,
      "sla_response_hours_p4" integer,
      "sla_resolution_hours_p1" integer,
      "sla_resolution_hours_p2" integer,
      "sla_resolution_hours_p3" integer,
      "sla_resolution_hours_p4" integer,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,
    `ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "is_under_contract" boolean NOT NULL DEFAULT false`,
    `ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "business_hours" jsonb`,
    `ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "sla_response_hours_p1" integer`,
    `ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "sla_response_hours_p2" integer`,
    `ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "sla_response_hours_p3" integer`,
    `ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "sla_response_hours_p4" integer`,
    `ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "sla_resolution_hours_p1" integer`,
    `ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "sla_resolution_hours_p2" integer`,
    `ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "sla_resolution_hours_p3" integer`,
    `ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "sla_resolution_hours_p4" integer`,
    `CREATE UNIQUE INDEX IF NOT EXISTS services_org_slug_unique ON services(org_id, slug)`,
    `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "service_id" uuid REFERENCES "services"("id") ON DELETE SET NULL`,
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
