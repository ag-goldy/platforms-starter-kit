import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const NEW_PASSWORDS = {
  'ag@agrnetworks.com': 'Admin@AGR2025!',
  'help@agrnetworks.com': 'Help@AGR2025!',
};

async function seed() {
  console.log('Starting seed...');
  
  const sql = neon(process.env.DATABASE_URL!);

  // Create admin user
  const agPasswordHash = await bcrypt.hash(NEW_PASSWORDS['ag@agrnetworks.com'], 10);
  
  try {
    // Check if user exists
    const existing = await sql`SELECT id FROM users WHERE email = 'ag@agrnetworks.com'`;
    
    if (existing.length > 0) {
      await sql`
        UPDATE users 
        SET password_hash = ${agPasswordHash}, 
            name = 'AG Administrator', 
            is_internal = true 
        WHERE email = 'ag@agrnetworks.com'
      `;
      console.log('✓ Reset password for: ag@agrnetworks.com');
    } else {
      await sql`
        INSERT INTO users (id, email, name, password_hash, is_internal, email_verified, created_at, updated_at)
        VALUES (gen_random_uuid(), 'ag@agrnetworks.com', 'AG Administrator', ${agPasswordHash}, true, NOW(), NOW(), NOW())
      `;
      console.log('✓ Created user: ag@agrnetworks.com');
    }
  } catch (e) {
    console.error('Error with ag@agrnetworks.com:', e);
  }

  // Create help user
  const helpPasswordHash = await bcrypt.hash(NEW_PASSWORDS['help@agrnetworks.com'], 10);
  
  try {
    const existing = await sql`SELECT id FROM users WHERE email = 'help@agrnetworks.com'`;
    
    if (existing.length > 0) {
      await sql`
        UPDATE users 
        SET password_hash = ${helpPasswordHash}, 
            name = 'Help Desk Agent', 
            is_internal = true 
        WHERE email = 'help@agrnetworks.com'
      `;
      console.log('✓ Reset password for: help@agrnetworks.com');
    } else {
      await sql`
        INSERT INTO users (id, email, name, password_hash, is_internal, email_verified, created_at, updated_at)
        VALUES (gen_random_uuid(), 'help@agrnetworks.com', 'Help Desk Agent', ${helpPasswordHash}, true, NOW(), NOW(), NOW())
      `;
      console.log('✓ Created user: help@agrnetworks.com');
    }
  } catch (e) {
    console.error('Error with help@agrnetworks.com:', e);
  }

  console.log('\n=================================');
  console.log('Credentials:');
  console.log('=================================');
  console.log('Admin User:');
  console.log('  Email:    ag@agrnetworks.com');
  console.log('  Password:', NEW_PASSWORDS['ag@agrnetworks.com']);
  console.log('');
  console.log('Help Desk User:');
  console.log('  Email:    help@agrnetworks.com');
  console.log('  Password:', NEW_PASSWORDS['help@agrnetworks.com']);
  console.log('=================================');
  
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
