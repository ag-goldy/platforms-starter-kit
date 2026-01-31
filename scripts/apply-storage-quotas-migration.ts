import { config } from 'dotenv';
import { resolve } from 'path';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function applyMigration() {
  console.log('Applying storage quotas migration...\n');

  const statements = [
    `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "storage_quota_bytes" BIGINT DEFAULT 10737418240`,
    `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "storage_used_bytes" BIGINT DEFAULT 0`,
    `CREATE INDEX IF NOT EXISTS idx_organizations_storage_quota ON organizations(storage_quota_bytes, storage_used_bytes)`,
    `UPDATE "organizations" SET "storage_used_bytes" = COALESCE((SELECT SUM("size") FROM "attachments" WHERE "attachments"."org_id" = "organizations"."id"), 0)`,
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

