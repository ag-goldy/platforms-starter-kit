import { config } from 'dotenv';
import { resolve } from 'path';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function applyMigration() {
  console.log('Applying user invitations migration...\n');

  const statements = [
    `CREATE TABLE IF NOT EXISTS "user_invitations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "email" text NOT NULL,
      "role" text NOT NULL CHECK (role IN ('CUSTOMER_ADMIN', 'REQUESTER', 'VIEWER')),
      "invited_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "token" text NOT NULL UNIQUE,
      "expires_at" timestamp NOT NULL,
      "accepted_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_user_invitations_org ON user_invitations(org_id)`,
    `CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token) WHERE accepted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email) WHERE accepted_at IS NULL`,
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

