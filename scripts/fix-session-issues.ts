import dotenv from 'dotenv';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });

async function fixSessionIssues() {
  console.log('Fixing session issues...\n');

  // Check if user_sessions table exists
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'user_sessions'
      ) as exists;
    `);
    
    const tableExists = result[0]?.exists;
    
    if (!tableExists) {
      console.log('Creating user_sessions table...');
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS user_sessions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          session_token text NOT NULL UNIQUE,
          ip_address text,
          user_agent text,
          created_at timestamp DEFAULT now() NOT NULL,
          expires_at timestamp NOT NULL,
          last_active_at timestamp DEFAULT now() NOT NULL
        );
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);`);
      console.log('✅ user_sessions table created');
    } else {
      console.log('✅ user_sessions table exists');
    }
  } catch (error) {
    console.error('❌ Failed to check/create user_sessions:', error);
  }

  console.log('\n✨ Session fixes applied!');
  console.log('\nIMPORTANT: Make sure your .env.local has:');
  console.log('  AUTH_SECRET=<a-random-64-char-hex-string>');
  console.log('  NEXTAUTH_URL=http://localhost:3000');
}

fixSessionIssues()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
