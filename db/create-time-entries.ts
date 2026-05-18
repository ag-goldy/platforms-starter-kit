import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

async function create() {
  const sql = neon(process.env.DATABASE_URL!);
  
  console.log('Creating time_entries table...\n');

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS time_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
        started_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP NOT NULL,
        duration_minutes INTEGER NOT NULL,
        description TEXT,
        is_billable BOOLEAN NOT NULL DEFAULT true,
        is_manual_entry BOOLEAN NOT NULL DEFAULT false,
        manual_date DATE,
        hourly_rate DECIMAL(10, 2),
        billed_amount DECIMAL(10, 2),
        invoice_id UUID,
        invoiced_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log('✓ time_entries table created');
    
    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_time_entries_ticket_id ON time_entries(ticket_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_time_entries_org_id ON time_entries(org_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id)`;
    console.log('✓ Indexes created');
    
  } catch (e) {
    console.error('Error creating time_entries:', e);
    process.exit(1);
  }
  
  console.log('\n✅ time_entries table created successfully!');
  process.exit(0);
}

create();
