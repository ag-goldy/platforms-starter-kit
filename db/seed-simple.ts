import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { users, organizations } from './schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

const NEW_PASSWORDS = {
  'ag@agrnetworks.com': 'Admin@AGR2025!',
  'help@agrnetworks.com': 'Help@AGR2025!',
};

async function seed() {
  console.log('Starting seed...');
  
  const client = neon(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema: { users, organizations } });

  // Create admin user
  const agPasswordHash = await bcrypt.hash(NEW_PASSWORDS['ag@agrnetworks.com'], 10);
  
  try {
    const existingAg = await db.select().from(users).where(eq(users.email, 'ag@agrnetworks.com')).limit(1);
    
    if (existingAg.length > 0) {
      await db.update(users)
        .set({ passwordHash: agPasswordHash, name: 'AG Administrator', isInternal: true })
        .where(eq(users.email, 'ag@agrnetworks.com'));
      console.log('✓ Reset password for: ag@agrnetworks.com');
    } else {
      await db.insert(users).values({
        email: 'ag@agrnetworks.com',
        name: 'AG Administrator',
        passwordHash: agPasswordHash,
        isInternal: true,
        emailVerified: new Date(),
      });
      console.log('✓ Created user: ag@agrnetworks.com');
    }
  } catch (e) {
    console.error('Error with ag@agrnetworks.com:', e);
  }

  // Create help user
  const helpPasswordHash = await bcrypt.hash(NEW_PASSWORDS['help@agrnetworks.com'], 10);
  
  try {
    const existingHelp = await db.select().from(users).where(eq(users.email, 'help@agrnetworks.com')).limit(1);
    
    if (existingHelp.length > 0) {
      await db.update(users)
        .set({ passwordHash: helpPasswordHash, name: 'Help Desk Agent', isInternal: true })
        .where(eq(users.email, 'help@agrnetworks.com'));
      console.log('✓ Reset password for: help@agrnetworks.com');
    } else {
      await db.insert(users).values({
        email: 'help@agrnetworks.com',
        name: 'Help Desk Agent',
        passwordHash: helpPasswordHash,
        isInternal: true,
        emailVerified: new Date(),
      });
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
