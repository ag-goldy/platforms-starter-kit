// Force postgres-js driver for script compatibility (must be before any imports)
process.env.DB_DRIVER = 'postgres';

import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Load env after setting DB_DRIVER
dotenv.config({ path: '.env.local' });

// Now import db
import { db } from '@/db';
import { internalGroupMemberships, internalGroups, users } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

const GLOBAL_ADMIN_EMAIL = 'ag@agrnetworks.com';
const GLOBAL_ADMIN_PASSWORD = 'AGRGlobal2025!';
const GLOBAL_ADMIN_NAME = 'AGR Global Administrator';

async function createGlobalAdmin() {
  console.log(`Creating/updating GLOBAL admin: ${GLOBAL_ADMIN_EMAIL}`);
  console.log('');

  const passwordHash = await bcrypt.hash(GLOBAL_ADMIN_PASSWORD, 10);

  // Check if user exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, GLOBAL_ADMIN_EMAIL),
  });

  let adminUser = existingUser;
  
  if (existingUser) {
    // Update existing user to be internal global admin
    await db
      .update(users)
      .set({
        passwordHash,
        name: GLOBAL_ADMIN_NAME,
        isInternal: true,
        emailVerified: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id));

    adminUser = await db.query.users.findFirst({
      where: eq(users.id, existingUser.id),
    });
    console.log('✅ Updated existing user to GLOBAL admin:', adminUser?.email);
  } else {
    // Create new global admin
    const [created] = await db
      .insert(users)
      .values({
        email: GLOBAL_ADMIN_EMAIL,
        name: GLOBAL_ADMIN_NAME,
        passwordHash,
        isInternal: true,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    adminUser = created;
    console.log('✅ Created GLOBAL admin user:', adminUser.email);
  }

  if (!adminUser) {
    throw new Error('Failed to create global admin user');
  }

  // Ensure PLATFORM_SUPER_ADMIN group exists
  let superAdminGroup = await db.query.internalGroups.findFirst({
    where: and(
      eq(internalGroups.scope, 'PLATFORM'),
      eq(internalGroups.roleType, 'PLATFORM_SUPER_ADMIN')
    ),
  });

  if (!superAdminGroup) {
    const [createdGroup] = await db
      .insert(internalGroups)
      .values({
        name: 'Platform Super Admins',
        description: 'Platform super administrators with full system access',
        scope: 'PLATFORM',
        roleType: 'PLATFORM_SUPER_ADMIN',
        createdBy: adminUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    superAdminGroup = createdGroup;
    console.log('✅ Created group:', superAdminGroup.name);
  } else {
    console.log('  Group exists:', superAdminGroup.name);
  }

  // Ensure PLATFORM_ADMIN group exists
  let adminGroup = await db.query.internalGroups.findFirst({
    where: and(
      eq(internalGroups.scope, 'PLATFORM'),
      eq(internalGroups.roleType, 'PLATFORM_ADMIN')
    ),
  });

  if (!adminGroup) {
    const [createdGroup] = await db
      .insert(internalGroups)
      .values({
        name: 'Platform Admins',
        description: 'Platform administrators',
        scope: 'PLATFORM',
        roleType: 'PLATFORM_ADMIN',
        createdBy: adminUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    adminGroup = createdGroup;
    console.log('✅ Created group:', adminGroup.name);
  } else {
    console.log('  Group exists:', adminGroup.name);
  }

  // Add user to super admin group
  if (superAdminGroup) {
    const existingMembership = await db.query.internalGroupMemberships.findFirst({
      where: and(
        eq(internalGroupMemberships.groupId, superAdminGroup.id),
        eq(internalGroupMemberships.userId, adminUser.id)
      ),
    });

    if (!existingMembership) {
      await db
        .insert(internalGroupMemberships)
        .values({
          groupId: superAdminGroup.id,
          userId: adminUser.id,
          role: 'ADMIN',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      console.log('✅ Added to Platform Super Admins group');
    } else {
      console.log('  Already in Platform Super Admins group');
    }
  }

  // Also add to admin group
  if (adminGroup) {
    const existingMembership = await db.query.internalGroupMemberships.findFirst({
      where: and(
        eq(internalGroupMemberships.groupId, adminGroup.id),
        eq(internalGroupMemberships.userId, adminUser.id)
      ),
    });

    if (!existingMembership) {
      await db
        .insert(internalGroupMemberships)
        .values({
          groupId: adminGroup.id,
          userId: adminUser.id,
          role: 'ADMIN',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      console.log('✅ Added to Platform Admins group');
    } else {
      console.log('  Already in Platform Admins group');
    }
  }

  console.log('\n========================================');
  console.log('🎉 GLOBAL ADMIN CREATED SUCCESSFULLY!');
  console.log('========================================');
  console.log(`Email:    ${GLOBAL_ADMIN_EMAIL}`);
  console.log(`Password: ${GLOBAL_ADMIN_PASSWORD}`);
  console.log(`Name:     ${GLOBAL_ADMIN_NAME}`);
  console.log('Access:   Platform Super Admin (Full System Access)');
  console.log('========================================\n');
}

createGlobalAdmin()
  .then(() => {
    console.log('Global admin setup complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to create global admin:', error);
    process.exit(1);
  });
