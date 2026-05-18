import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

async function create() {
  const sql = neon(process.env.DATABASE_URL!);
  
  console.log('Creating ticket_subtasks table...\n');

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS ticket_subtasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
        priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high'
        assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        assigned_to_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
        completed_at TIMESTAMP,
        completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        completed_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
        due_date TIMESTAMP,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('✓ ticket_subtasks table created');
    
    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_ticket_subtasks_ticket_id ON ticket_subtasks(ticket_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ticket_subtasks_org_id ON ticket_subtasks(org_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ticket_subtasks_status ON ticket_subtasks(status)`;
    console.log('✓ Indexes created');
    
  } catch (e) {
    console.error('Error creating ticket_subtasks:', e);
    process.exit(1);
  }
  
  console.log('\n✅ ticket_subtasks table created successfully!');
  process.exit(0);
}

create();
