import { config } from 'dotenv';
import { resolve } from 'path';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function applyMigration() {
  console.log('Applying automation rules migration...\n');

  const statements = [
    `CREATE TABLE IF NOT EXISTS "automation_rules" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "enabled" boolean DEFAULT true NOT NULL,
      "priority" integer DEFAULT 0 NOT NULL,
      "trigger_on" text NOT NULL CHECK (trigger_on IN ('CREATE', 'UPDATE', 'COMMENT')),
      "conditions" text NOT NULL,
      "actions" text NOT NULL,
      "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON automation_rules(org_id)`,
    `CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled ON automation_rules(org_id, enabled, priority) WHERE enabled = true`,
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

