import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

async function apply() {
  const sql = neon(process.env.DATABASE_URL!);
  
  console.log('Creating platform_admins table...');
  
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS platform_admins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'ADMIN',
        is_active BOOLEAN NOT NULL DEFAULT true,
        two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
        two_factor_secret TEXT,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('✓ Table created');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_platform_admins_email ON platform_admins(email)`;
    console.log('✓ Email index created');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_platform_admins_active ON platform_admins(is_active)`;
    console.log('✓ Active index created');
    
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
  
  console.log('\nMigration complete!');
  process.exit(0);
}

apply();
