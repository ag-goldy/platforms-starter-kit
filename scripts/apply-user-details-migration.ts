import { config } from 'dotenv';
import { resolve } from 'path';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function applyMigration() {
  console.log('Applying user details migration...\n');

  const statements = [
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" text`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "job_title" text`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" text`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notes" text`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_backup_codes" text`,
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
