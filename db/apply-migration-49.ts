import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

async function apply() {
  const sql = neon(process.env.DATABASE_URL!);
  
  console.log('Applying migration 49: Platform Admin FK Fix...\n');
  
  try {
    // Fix automation_rules
    await sql`ALTER TABLE automation_rules DROP CONSTRAINT IF EXISTS automation_rules_created_by_users_id_fk`;
    await sql`ALTER TABLE automation_rules ALTER COLUMN created_by DROP NOT NULL`;
    await sql`ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS created_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ automation_rules updated');
    
    // Fix kb_articles
    await sql`ALTER TABLE kb_articles DROP CONSTRAINT IF EXISTS kb_articles_author_id_fkey`;
    await sql`ALTER TABLE kb_articles ALTER COLUMN author_id DROP NOT NULL`;
    await sql`ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS author_platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ kb_articles updated');
    
    // Fix audit_logs
    await sql`ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_users_id_fk`;
    await sql`ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL`;
    await sql`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ audit_logs updated');
    
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
  
  console.log('\n✅ Migration 49 applied successfully!');
  process.exit(0);
}

apply();
