import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

async function fix() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("Fixing more platform admin foreign key constraints...\n");

  // Fix ticket_dependencies
  try {
    await sql`ALTER TABLE ticket_dependencies DROP CONSTRAINT IF EXISTS ticket_dependencies_created_by_id_fkey`;
    await sql`ALTER TABLE ticket_dependencies ALTER COLUMN created_by_id DROP NOT NULL`;
    await sql`ALTER TABLE ticket_dependencies ADD COLUMN IF NOT EXISTS created_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log("✓ ticket_dependencies fixed");
  } catch (e) {
    console.error("✗ ticket_dependencies:", e);
  }

  // Fix ticket_links
  try {
    await sql`ALTER TABLE ticket_links DROP CONSTRAINT IF EXISTS ticket_links_created_by_fkey`;
    await sql`ALTER TABLE ticket_links ALTER COLUMN created_by DROP NOT NULL`;
    await sql`ALTER TABLE ticket_links ADD COLUMN IF NOT EXISTS created_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log("✓ ticket_links fixed");
  } catch (e) {
    console.error("✗ ticket_links:", e);
  }

  // Create canned_response_templates table if not exists
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS canned_response_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        subject TEXT,
        content TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT false,
        is_global BOOLEAN DEFAULT false,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_canned_templates_org_id ON canned_response_templates(org_id)`;
    console.log("✓ canned_response_templates table created");
  } catch (e) {
    console.error("✗ canned_response_templates:", e);
  }

  // Create ticket_tags table if not exists
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS ticket_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6B7280',
        description TEXT,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(org_id, name)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_ticket_tags_org_id ON ticket_tags(org_id)`;
    console.log("✓ ticket_tags table created");
  } catch (e) {
    console.error("✗ ticket_tags:", e);
  }

  // Create ticket_tag_mappings table
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS ticket_tag_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        tag_id UUID NOT NULL REFERENCES ticket_tags(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(ticket_id, tag_id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_ticket_tag_mappings_ticket_id ON ticket_tag_mappings(ticket_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ticket_tag_mappings_tag_id ON ticket_tag_mappings(tag_id)`;
    console.log("✓ ticket_tag_mappings table created");
  } catch (e) {
    console.error("✗ ticket_tag_mappings:", e);
  }

  console.log("\n✅ All FK constraints and template tables fixed!");
  process.exit(0);
}

fix();
