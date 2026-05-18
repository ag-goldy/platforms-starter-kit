/**
 * Seed Platform Admins
 *
 * This script creates platform administrators who manage the Atlas platform itself.
 * These are COMPLETELY SEPARATE from tenant users in the 'users' table.
 *
 * Platform admins can:
 * - Manage the platform settings
 * - View all organizations (read-only unless requested)
 * - Manage platform-level configurations
 *
 * They CANNOT:
 * - Be members of tenant organizations
 * - Be assigned tenant tickets
 * - Appear in tenant user lists
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const PLATFORM_ADMINS = [
  {
    email: "ag@agrnetworks.com",
    name: "AG Super Admin",
    password: "Admin@AGR2025!",
    role: "SUPER_ADMIN",
  },
  {
    email: "help@agrnetworks.com",
    name: "Help Desk Support",
    password: "Help@AGR2025!",
    role: "SUPPORT",
  },
];

async function seed() {
  console.log("Seeding Platform Admins...");
  console.log("===========================\n");

  const sql = neon(process.env.DATABASE_URL!);

  for (const admin of PLATFORM_ADMINS) {
    const passwordHash = await bcrypt.hash(admin.password, 10);

    try {
      // Check if admin exists
      const existing =
        await sql`SELECT id FROM platform_admins WHERE email = ${admin.email}`;

      if (existing.length > 0) {
        await sql`
          UPDATE platform_admins 
          SET password_hash = ${passwordHash}, 
              name = ${admin.name}, 
              role = ${admin.role},
              is_active = true,
              updated_at = NOW()
          WHERE email = ${admin.email}
        `;
        console.log(
          "✓ Updated platform admin:",
          admin.email,
          `(${admin.role})`,
        );
      } else {
        await sql`
          INSERT INTO platform_admins (id, email, name, password_hash, role, is_active, created_at, updated_at)
          VALUES (gen_random_uuid(), ${admin.email}, ${admin.name}, ${passwordHash}, ${admin.role}, true, NOW(), NOW())
        `;
        console.log(
          "✓ Created platform admin:",
          admin.email,
          `(${admin.role})`,
        );
      }
    } catch (e) {
      console.error("✗ Error with", admin.email, ":", e);
    }
  }

  console.log("\n===========================");
  console.log("Platform Admin Credentials:");
  console.log("===========================");
  console.log("");
  console.log("⚠️  IMPORTANT: These are PLATFORM admins, NOT tenant users!");
  console.log("");
  for (const admin of PLATFORM_ADMINS) {
    console.log(`${admin.role}:`);
    console.log(`  Email:    ${admin.email}`);
    console.log(`  Password: ${admin.password}`);
    console.log("");
  }
  console.log("===========================\n");

  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
