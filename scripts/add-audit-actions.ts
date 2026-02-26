import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import postgres from 'postgres';

async function addAuditActions() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1 });
  
  try {
    console.log('Adding audit action enum values...\n');
    
    // Add ORG_DISABLED
    await sql`ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ORG_DISABLED'`;
    console.log('✓ Added ORG_DISABLED');
    
    // Add ORG_ENABLED
    await sql`ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ORG_ENABLED'`;
    console.log('✓ Added ORG_ENABLED');
    
    // Add ORG_DELETED
    await sql`ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'ORG_DELETED'`;
    console.log('✓ Added ORG_DELETED');
    
    console.log('\n✅ Audit actions added successfully!');
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to add audit actions:', error);
    await sql.end();
    process.exit(1);
  }
}

addAuditActions();
