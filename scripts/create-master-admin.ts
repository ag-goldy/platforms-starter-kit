import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { internalGroupMemberships, internalGroups, users } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });

const MASTER_ADMIN_EMAIL = 'agradm@agrnetworks.com';
const MASTER_ADMIN_PASSWORD = process.env.MASTER_ADMIN_PASSWORD || 'MasterPass123!';
const MASTER_ADMIN_NAME = 'AGR Master Admin';

async function createMasterAdmin() {
  console.log(`Creating/updating master admin: ${MASTER_ADMIN_EMAIL}`);

  const passwordHash = await bcrypt.hash(MASTER_ADMIN_PASSWORD, 10);

  // Check if user exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, MASTER_ADMIN_EMAIL),
  });

  let adminUser = existingUser;
  
  if (existingUser) {
    // Update existing user to be internal admin
    await db
      .update(users)
      .set({
        passwordHash,
        name: MASTER_ADMIN_NAME,
        isInternal: true,
        emailVerified: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id));

    adminUser = await db.query.users.findFirst({
      where: eq(users.id, existingUser.id),
    });
    console.log('✅ Updated existing user to master admin:', adminUser?.email);
  } else {
    // Create new master admin
    const [created] = await db
      .insert(users)
      .values({
        email: MASTER_ADMIN_EMAIL,
        name: MASTER_ADMIN_NAME,
        passwordHash,
        isInternal: true,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    adminUser = created;
    console.log('✅ Created master admin:', adminUser.email);
  }

  if (!adminUser) {
    throw new Error('Failed to create master admin user');
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
        description: 'Platform super administrators with full access',
        scope: 'PLATFORM',
        roleType: 'PLATFORM_SUPER_ADMIN',
        createdBy: adminUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    superAdminGroup = createdGroup;
    console.log('✅ Created group:', superAdminGroup.name);
  }

  // Also ensure PLATFORM_ADMIN group exists
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
  }

  // Add user to super admin group
  if (superAdminGroup) {
    await db
      .insert(internalGroupMemberships)
      .values({
        groupId: superAdminGroup.id,
        userId: adminUser.id,
        role: 'ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    console.log('✅ Added to Platform Super Admins group');
  }

  // Also add to admin group
  if (adminGroup) {
    await db
      .insert(internalGroupMemberships)
      .values({
        groupId: adminGroup.id,
        userId: adminUser.id,
        role: 'ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    console.log('✅ Added to Platform Admins group');
  }

  console.log('\n========================================');
  console.log('🎉 Master Admin Created Successfully!');
  console.log('========================================');
  console.log(`Email:    ${MASTER_ADMIN_EMAIL}`);
  console.log(`Password: ${MASTER_ADMIN_PASSWORD}`);
  console.log(`Name:     ${MASTER_ADMIN_NAME}`);
  console.log('========================================\n');
}

createMasterAdmin()
  .then(() => {
    console.log('Master admin ready.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to create master admin:', error);
    process.exit(1);
  });
