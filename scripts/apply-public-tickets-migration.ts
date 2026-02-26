#!/usr/bin/env tsx
/**
 * Apply migration to make org_id nullable in tickets table
 * This allows public tickets to be created without org association
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL is not set');
  process.exit(1);
}

async function main() {
  console.log('Connecting to database...');
  
  // Create postgres connection
  const client = postgres(DATABASE_URL!, { max: 1 });
  const db = drizzle(client);

  try {
    console.log('Applying migration: Make org_id nullable in tickets table...');
    
    // Check tickets table
    const ticketCheck = await client`
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'tickets' 
      AND column_name = 'org_id'
    `;
    
    if (ticketCheck.length > 0 && ticketCheck[0].is_nullable === 'YES') {
      console.log('✓ tickets.org_id is already nullable');
    } else {
      // Make org_id nullable in tickets
      await client`ALTER TABLE tickets ALTER COLUMN org_id DROP NOT NULL`;
      console.log('✓ Made org_id nullable in tickets table');
      
      // Add comment
      await client`
        COMMENT ON COLUMN tickets.org_id IS 
        'Organization ID. NULL for public tickets created via email or support form without org association.'
      `;
      console.log('✓ Added column comment to tickets.org_id');
    }
    
    // Check attachments table
    const attachmentCheck = await client`
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'attachments' 
      AND column_name = 'org_id'
    `;
    
    if (attachmentCheck.length > 0 && attachmentCheck[0].is_nullable === 'YES') {
      console.log('✓ attachments.org_id is already nullable');
    } else {
      // Make org_id nullable in attachments
      await client`ALTER TABLE attachments ALTER COLUMN org_id DROP NOT NULL`;
      console.log('✓ Made org_id nullable in attachments table');
      
      // Add comment
      await client`
        COMMENT ON COLUMN attachments.org_id IS 
        'Organization ID. NULL for attachments on public tickets.'
      `;
      console.log('✓ Added column comment to attachments.org_id');
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('Public tickets can now be created without an organization.');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
