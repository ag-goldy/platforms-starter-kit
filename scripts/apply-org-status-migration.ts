import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import postgres from 'postgres';

async function applyMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1 });
  
  try {
    console.log('Applying organization status migration...\n');
    
    // Add is_active column
    await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL`;
    console.log('✓ Added is_active column');
    
    // Add disabled_at column
    await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP`;
    console.log('✓ Added disabled_at column');
    
    // Add disabled_by column
    await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS disabled_by TEXT`;
    console.log('✓ Added disabled_by column');
    
    // Add deleted_at column
    await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`;
    console.log('✓ Added deleted_at column');
    
    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active)`;
    console.log('✓ Created idx_organizations_is_active');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_organizations_subdomain_active ON organizations(subdomain, is_active) WHERE deleted_at IS NULL`;
    console.log('✓ Created idx_organizations_subdomain_active');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_organizations_disabled ON organizations(disabled_at) WHERE is_active = FALSE AND deleted_at IS NULL`;
    console.log('✓ Created idx_organizations_disabled');
    
    console.log('\n✅ Migration applied successfully!');
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    await sql.end();
    process.exit(1);
  }
}

applyMigration();
