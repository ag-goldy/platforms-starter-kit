/**
 * Cleanup: Remove internal users that were incorrectly created in the tenant users table
 * These should have been platform admins instead
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

async function cleanup() {
  const sql = neon(process.env.DATABASE_URL!);
  
  console.log('Cleaning up incorrectly created internal users...\n');
  
  // List users with isInternal=true that shouldn't be there
  const internalUsers = await sql`
    SELECT id, email, name, is_internal 
    FROM users 
    WHERE is_internal = true 
    AND email IN ('ag@agrnetworks.com', 'help@agrnetworks.com')
  `;
  
  if (internalUsers.length === 0) {
    console.log('No incorrectly created internal users found.');
    console.log('Platform admins are correctly in the platform_admins table.');
    process.exit(0);
  }
  
  console.log('Found internal users in tenant table:');
  for (const user of internalUsers) {
    console.log(`  - ${user.email} (${user.name})`);
  }
  
  console.log('\nThese users should be PLATFORM ADMINS, not tenant users.');
  console.log('Deleting from users table (they now exist in platform_admins table)...\n');
  
  for (const user of internalUsers) {
    try {
      await sql`DELETE FROM users WHERE id = ${user.id}`;
      console.log(`✓ Removed ${user.email} from users table`);
    } catch (e) {
      console.error(`✗ Failed to remove ${user.email}:`, e);
    }
  }
  
  console.log('\nCleanup complete!');
  console.log('Platform admins are now correctly separated from tenant users.');
  process.exit(0);
}

cleanup().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});
