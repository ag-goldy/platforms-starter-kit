import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

async function create() {
  const sql = neon(process.env.DATABASE_URL!);
  
  console.log('Creating ticket_dependencies and ticket_watchers tables...\n');

  // Create ticket_dependencies
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS ticket_dependencies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        depends_on_ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        dependency_type TEXT NOT NULL, -- 'blocks', 'blocked_by', 'relates_to'
        created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('✓ ticket_dependencies table created');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_ticket_dependencies_ticket_id ON ticket_dependencies(ticket_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ticket_dependencies_depends_on ON ticket_dependencies(depends_on_ticket_id)`;
    console.log('  Indexes created');
  } catch (e) {
    console.error('✗ ticket_dependencies:', e);
  }

  // Create ticket_watchers
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS ticket_watchers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(ticket_id, user_id),
        UNIQUE(ticket_id, platform_admin_id)
      )
    `;
    console.log('✓ ticket_watchers table created');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_ticket_watchers_ticket_id ON ticket_watchers(ticket_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ticket_watchers_user_id ON ticket_watchers(user_id)`;
    console.log('  Indexes created');
  } catch (e) {
    console.error('✗ ticket_watchers:', e);
  }

  console.log('\n✅ Tables created successfully!');
  process.exit(0);
}

create();
