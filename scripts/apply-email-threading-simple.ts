import { config } from 'dotenv';
import { resolve } from 'path';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function applyMigration() {
  console.log('Applying email threading migration...\n');

  const statements = [
    `ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "message_id" TEXT`,
    `ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "in_reply_to" TEXT`,
    `ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "references" TEXT`,
    `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "email_thread_id" TEXT`,
    `CREATE INDEX IF NOT EXISTS idx_comments_message_id ON ticket_comments(message_id)`,
    `CREATE INDEX IF NOT EXISTS idx_comments_in_reply_to ON ticket_comments(in_reply_to)`,
    `CREATE INDEX IF NOT EXISTS idx_tickets_email_thread_id ON tickets(email_thread_id)`,
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

