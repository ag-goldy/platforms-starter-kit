#!/usr/bin/env tsx
/**
 * Add purpose column and enum to ticket_tokens table
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
  
  const client = postgres(DATABASE_URL!, { max: 1 });

  try {
    console.log('Adding ticket_token_purpose enum and purpose column...');
    
    // Check if enum exists
    const enumCheck = await client`
      SELECT EXISTS (
        SELECT 1 FROM pg_type 
        WHERE typname = 'ticket_token_purpose'
      ) as exists
    `;
    
    if (!enumCheck[0].exists) {
      // Create enum type
      await client`CREATE TYPE ticket_token_purpose AS ENUM ('VIEW', 'REPLY')`;
      console.log('✓ Created ticket_token_purpose enum');
    } else {
      console.log('✓ ticket_token_purpose enum already exists');
    }
    
    // Check if purpose column exists
    const columnCheck = await client`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_tokens' 
        AND column_name = 'purpose'
      ) as exists
    `;
    
    if (!columnCheck[0].exists) {
      // Add purpose column
      await client`ALTER TABLE ticket_tokens ADD COLUMN purpose ticket_token_purpose NOT NULL DEFAULT 'VIEW'`;
      console.log('✓ Added purpose column to ticket_tokens');
    } else {
      console.log('✓ purpose column already exists');
    }
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
