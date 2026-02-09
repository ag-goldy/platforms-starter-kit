/**
 * Vercel Auth Setup Helper
 * 
 * This script helps diagnose and fix auth issues when deploying to Vercel.
 * 
 * Common Issues:
 * 1. JWTSessionError: no matching decryption secret
 *    - Cause: AUTH_SECRET on Vercel doesn't match local
 *    - Fix: Set the same AUTH_SECRET in Vercel dashboard
 * 
 * 2. User not found after login
 *    - Cause: Database connection issue or user doesn't exist
 *    - Fix: Run create-master-admin.ts to create the admin user
 * 
 * 3. Cookie conflicts
 *    - Cause: Cookies from localhost conflicting with production
 *    - Fix: Clear browser cookies or use incognito mode
 */

import dotenv from 'dotenv';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });

const ADMIN_EMAIL = 'agradm@agrnetworks.com';

async function diagnoseAuth() {
  console.log('🔍 Diagnosing Auth Configuration...\n');

  // Check environment variables
  const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  
  console.log('Environment Variables:');
  console.log('  AUTH_SECRET:', authSecret ? '✅ Set (' + authSecret.substring(0, 8) + '...)' : '❌ NOT SET');
  console.log('  NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ NOT SET');
  console.log('  NEXT_PUBLIC_ROOT_DOMAIN:', process.env.NEXT_PUBLIC_ROOT_DOMAIN || '❌ NOT SET');
  console.log('  APP_BASE_URL:', process.env.APP_BASE_URL || '❌ NOT SET');
  console.log('  DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ NOT SET');
  console.log();

  // Check database connection
  console.log('Database Connection:');
  try {
    const userCount = await db.query.users.findMany({
      columns: { id: true, email: true, isInternal: true },
      limit: 5,
    });
    console.log(`  ✅ Connected - Found ${userCount.length} users`);
    userCount.forEach(u => {
      console.log(`     - ${u.email} (Internal: ${u.isInternal})`);
    });
  } catch (error) {
    console.log('  ❌ Failed to connect:', error instanceof Error ? error.message : error);
  }
  console.log();

  // Check for master admin
  console.log('Master Admin Check:');
  try {
    const adminUser = await db.query.users.findFirst({
      where: eq(users.email, ADMIN_EMAIL),
    });
    
    if (adminUser) {
      console.log(`  ✅ Master admin exists: ${adminUser.email}`);
      console.log(`     - Internal: ${adminUser.isInternal}`);
      console.log(`     - Verified: ${adminUser.emailVerified ? 'Yes' : 'No'}`);
      console.log(`     - Has Password: ${adminUser.passwordHash ? 'Yes' : 'No'}`);
    } else {
      console.log(`  ❌ Master admin not found: ${ADMIN_EMAIL}`);
      console.log(`     Run: npx tsx scripts/create-master-admin.ts`);
    }
  } catch (error) {
    console.log('  ❌ Error:', error instanceof Error ? error.message : error);
  }
  console.log();

  // Vercel Setup Instructions
  console.log('===============================================');
  console.log('📋 VERCEL DEPLOYMENT CHECKLIST');
  console.log('===============================================');
  console.log();
  console.log('1. Set Environment Variables in Vercel Dashboard:');
  console.log('   - Go to Project Settings → Environment Variables');
  console.log('   - Add these variables:');
  console.log();
  console.log('   AUTH_SECRET=' + (authSecret || '[GENERATE_ONE_WITH: openssl rand -base64 32]'));
  console.log('   DATABASE_URL=' + (process.env.DATABASE_URL || '[YOUR_DATABASE_URL]'));
  console.log('   NEXT_PUBLIC_ROOT_DOMAIN=atlas.agrnetworks.com');
  console.log('   APP_BASE_URL=https://atlas.agrnetworks.com');
  console.log('   INTERNAL_ADMIN_EMAILS=agradm@agrnetworks.com');
  console.log();
  console.log('2. IMPORTANT: AUTH_SECRET must be the SAME across:');
  console.log('   - Your local .env.local');
  console.log('   - Vercel Production environment');
  console.log('   - Vercel Preview environments (if using preview deployments)');
  console.log();
  console.log('3. Generate a new AUTH_SECRET:');
  console.log('   openssl rand -base64 32');
  console.log('   # Or use: https://generate-secret.vercel.app/32');
  console.log();
  console.log('4. After setting env vars, redeploy:');
  console.log('   - Vercel Dashboard → Deployments → Redeploy');
  console.log();
  console.log('5. Clear browser cookies:');
  console.log('   - Open DevTools → Application → Cookies → Clear All');
  console.log('   - Or use Incognito/Private browsing mode');
  console.log();
  console.log('6. Run this script on Vercel (via CLI) to create admin:');
  console.log('   vercel env pull .env.local');
  console.log('   npx tsx scripts/create-master-admin.ts');
  console.log();
  console.log('===============================================');
}

diagnoseAuth()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Diagnosis failed:', error);
    process.exit(1);
  });
