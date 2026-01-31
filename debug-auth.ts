import { db } from './db/index';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function debugAuth() {
  console.log('Testing authentication...\n');

  // Test 1: Check if user exists
  const [user] = await db.select().from(users).where(eq(users.email, 'admin@agr.com'));

  if (!user) {
    console.log('❌ User not found in database');
    return;
  }

  console.log('✅ User found:', user.email);
  console.log('   ID:', user.id);
  console.log('   isInternal:', user.isInternal);
  console.log('   Has passwordHash:', !!user.passwordHash);
  console.log('   passwordHash length:', user.passwordHash?.length || 0);

  // Test 2: Hash a new password and compare
  const testPassword = 'admin123';
  const newHash = await bcrypt.hash(testPassword, 10);
  console.log('\n📝 New hash generated:', newHash.substring(0, 20) + '...');

  // Test 3: Compare with stored hash
  if (user.passwordHash) {
    const isValid = await bcrypt.compare(testPassword, user.passwordHash);
    console.log('\n🔐 Password comparison result:', isValid ? '✅ VALID' : '❌ INVALID');

    // Test 4: Compare with newly generated hash
    const isValidNew = await bcrypt.compare(testPassword, newHash);
    console.log('🔐 New hash comparison result:', isValidNew ? '✅ VALID' : '❌ INVALID');

    // Show first few chars of stored hash
    console.log('\n📋 Stored hash (first 30 chars):', user.passwordHash.substring(0, 30) + '...');
  } else {
    console.log('\n❌ No password hash stored for user');
  }
}

debugAuth()
  .then(() => {
    console.log('\n✅ Debug complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

