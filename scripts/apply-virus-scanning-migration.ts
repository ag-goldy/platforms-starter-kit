import { config } from 'dotenv';
import { resolve } from 'path';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function applyMigration() {
  console.log('Applying virus scanning migration...\n');

  const statements = [
    `ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "scan_status" TEXT DEFAULT 'PENDING'`,
    `ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "scan_result" TEXT`,
    `ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "scanned_at" TIMESTAMP`,
    `ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "is_quarantined" BOOLEAN DEFAULT false`,
    `CREATE INDEX IF NOT EXISTS idx_attachments_scan_status ON attachments(scan_status)`,
    `CREATE INDEX IF NOT EXISTS idx_attachments_quarantined ON attachments(is_quarantined) WHERE is_quarantined = true`,
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

