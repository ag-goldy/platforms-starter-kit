import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function main() {
  const sql = postgres(DATABASE_URL, { max: 1 });
  
  try {
    console.log('Applying migration...');
    
    // Add access_urls column
    await sql`ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "access_urls" jsonb`;
    console.log('✓ Added access_urls column');
    
    // Check if type column is still an enum
    const typeCol = await sql`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'assets' AND column_name = 'type'
    `;
    
    if (typeCol[0]?.data_type === 'USER-DEFINED') {
      console.log('Converting type column from enum to text...');
      await sql`ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "type_text" text DEFAULT 'OTHER' NOT NULL`;
      await sql`UPDATE "assets" SET "type_text" = "type"::text`;
      await sql`ALTER TABLE "assets" DROP COLUMN "type"`;
      await sql`ALTER TABLE "assets" RENAME COLUMN "type_text" TO "type"`;
      console.log('✓ Converted type column to text');
    }
    
    // Check if status column is still an enum
    const statusCol = await sql`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'assets' AND column_name = 'status'
    `;
    
    if (statusCol[0]?.data_type === 'USER-DEFINED') {
      console.log('Converting status column from enum to text...');
      await sql`ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "status_text" text DEFAULT 'ACTIVE' NOT NULL`;
      await sql`UPDATE "assets" SET "status_text" = "status"::text`;
      await sql`ALTER TABLE "assets" DROP COLUMN "status"`;
      await sql`ALTER TABLE "assets" RENAME COLUMN "status_text" TO "status"`;
      console.log('✓ Converted status column to text');
    }
    
    // Create org_asset_types table
    await sql`
      CREATE TABLE IF NOT EXISTS "org_asset_types" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "label" text NOT NULL,
        "description" text,
        "color" text DEFAULT '#6B7280',
        "icon" text,
        "is_active" boolean DEFAULT true NOT NULL,
        "sort_order" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `;
    console.log('✓ Created org_asset_types table');
    
    // Create org_asset_statuses table
    await sql`
      CREATE TABLE IF NOT EXISTS "org_asset_statuses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "label" text NOT NULL,
        "description" text,
        "color" text DEFAULT '#6B7280',
        "is_active" boolean DEFAULT true NOT NULL,
        "sort_order" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `;
    console.log('✓ Created org_asset_statuses table');
    
    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS "org_asset_types_org_id_idx" ON "org_asset_types"("org_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "org_asset_types_is_active_idx" ON "org_asset_types"("is_active")`;
    await sql`CREATE INDEX IF NOT EXISTS "org_asset_statuses_org_id_idx" ON "org_asset_statuses"("org_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "org_asset_statuses_is_active_idx" ON "org_asset_statuses"("is_active")`;
    console.log('✓ Created indexes');
    
    console.log('\n✅ Migration applied successfully!');
    
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
