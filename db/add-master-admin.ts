/**
 * Add Master Admin Account
 *
 * Creates a platform admin for: accounts-atlas@agrnetworks.com
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const MASTER_ADMIN = {
  email: "accounts-atlas@agrnetworks.com",
  name: "Atlas Master Administrator",
  password: "Master@Atlas2025!", // You should change this after first login
  role: "SUPER_ADMIN",
};

async function addMasterAdmin() {
  console.log("Adding Master Admin...\n");

  const sql = neon(process.env.DATABASE_URL!);

  const passwordHash = await bcrypt.hash(MASTER_ADMIN.password, 10);

  try {
    // Check if admin exists
    const existing =
      await sql`SELECT id FROM platform_admins WHERE email = ${MASTER_ADMIN.email}`;

    if (existing.length > 0) {
      await sql`
        UPDATE platform_admins 
        SET password_hash = ${passwordHash}, 
            name = ${MASTER_ADMIN.name}, 
            role = ${MASTER_ADMIN.role},
            is_active = true,
            updated_at = NOW()
        WHERE email = ${MASTER_ADMIN.email}
      `;
      console.log("✓ Updated master admin:", MASTER_ADMIN.email);
    } else {
      await sql`
        INSERT INTO platform_admins (id, email, name, password_hash, role, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), ${MASTER_ADMIN.email}, ${MASTER_ADMIN.name}, ${passwordHash}, ${MASTER_ADMIN.role}, true, NOW(), NOW())
      `;
      console.log("✓ Created master admin:", MASTER_ADMIN.email);
    }
  } catch (e) {
    console.error("✗ Error:", e);
    process.exit(1);
  }

  console.log("\n=================================");
  console.log("Master Admin Credentials:");
  console.log("=================================");
  console.log("Email:    ", MASTER_ADMIN.email);
  console.log("Password: ", MASTER_ADMIN.password);
  console.log("Role:     ", MASTER_ADMIN.role);
  console.log("=================================");
  console.log("\n⚠️  IMPORTANT: Change the password after first login!");

  process.exit(0);
}

addMasterAdmin();
