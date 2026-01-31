
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from '../db';
import { sql } from 'drizzle-orm';

interface ColumnInfo {
  column_name: string;
  data_type?: string;
}

async function checkSchema() {
  console.log('Checking database schema...');

  // Check tickets table columns
  const ticketColumns = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tickets'
  `);
  
  console.log('\nTickets table columns:');
  ticketColumns.forEach((col: unknown) => {
    const column = col as ColumnInfo;
    console.log(`- ${column.column_name} (${column.data_type})`);
  });

  // Check request_types table
  const requestTypesTable = await db.execute(sql`
    SELECT exists (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'request_types'
    );
  `);
  
  console.log('\nrequest_types table exists:', requestTypesTable[0].exists);

  if (requestTypesTable[0].exists) {
     const requestTypesColumns = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'request_types'
      `);
      console.log('request_types columns:');
      requestTypesColumns.forEach((col: unknown) => {
        const column = col as ColumnInfo;
        console.log(`- ${column.column_name} (${column.data_type})`);
      });
  }

  // Check users table
  const userColumns = await db.execute(sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name IN ('manager_id', 'two_factor_backup_codes')
  `);
  console.log('\nUsers table check (manager_id, two_factor_backup_codes):');
  userColumns.forEach((col: unknown) => console.log(`- ${(col as ColumnInfo).column_name} exists`));

  // Check organizations table
  const orgColumns = await db.execute(sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'allow_public_intake'
  `);
  console.log('\nOrganizations table check (allow_public_intake):');
  orgColumns.forEach((col: unknown) => console.log(`- ${(col as ColumnInfo).column_name} exists`));

  // Check assets table
  const assetColumns = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'assets'
  `);
  
  console.log('\nAssets table columns:');
  assetColumns.forEach((col: unknown) => {
    const column = col as ColumnInfo;
    console.log(`- ${column.column_name} (${column.data_type})`);
  });

  // Check automation_rules table
    const automationRulesColumns = await db.execute(sql`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'automation_rules'
    `);
    
    console.log('\nAutomation Rules table columns:');
    automationRulesColumns.forEach((col: unknown) => {
      const column = col as ColumnInfo & { udt_name: string };
      console.log(`- ${column.column_name} (${column.data_type}) [${column.udt_name}]`);
    });

  // Check automation_trigger enum values
    const enumValues = await db.execute(sql`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'automation_trigger'
    `);
    
    console.log('\nAutomation Trigger Enum values:');
    enumValues.forEach((val: unknown) => {
      const v = val as { enumlabel: string };
      console.log(`- ${v.enumlabel}`);
    });

    // Check audit_action enum values
    const auditActionEnumValues = await db.execute(sql`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'audit_action'
    `);
    
    console.log('\nAudit Action Enum values:');
    auditActionEnumValues.forEach((val: unknown) => {
      const v = val as { enumlabel: string };
      console.log(`- ${v.enumlabel}`);
    });

    console.log('\nSchema check completed.');

  process.exit(0);
}

checkSchema().catch(console.error);
