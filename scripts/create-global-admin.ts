import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { internalGroupMemberships, internalGroups, users } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });

const email = process.env.ADMIN_EMAIL || '';
const password = process.env.ADMIN_PASSWORD || '';
const name = process.env.ADMIN_NAME || 'AGR Global Admin';

if (!email || !password) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD are required.');
  process.exit(1);
}

async function createGlobalAdmin() {
  const passwordHash = await bcrypt.hash(password, 10);

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  let adminUser = existingUser;
  if (existingUser) {
    await db
      .update(users)
      .set({
        passwordHash,
        name,
        isInternal: true,
        emailVerified: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id));

    adminUser = await db.query.users.findFirst({
      where: eq(users.id, existingUser.id),
    });
    console.log('Updated admin user:', adminUser?.email);
  } else {
    const [created] = await db
      .insert(users)
      .values({
        email,
        name,
        passwordHash,
        isInternal: true,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    adminUser = created;
    console.log('Created admin user:', adminUser.email);
  }

  if (!adminUser) {
    throw new Error('Failed to create admin user');
  }

  let group = await db.query.internalGroups.findFirst({
    where: and(
      eq(internalGroups.scope, 'PLATFORM'),
      eq(internalGroups.roleType, 'PLATFORM_ADMIN')
    ),
  });

  if (!group) {
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
    group = createdGroup;
    console.log('Created internal group:', group.name);
  }

  if (group) {
    await db
      .insert(internalGroupMemberships)
      .values({
        groupId: group.id,
        userId: adminUser.id,
        role: 'ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    console.log('Ensured platform admin membership for:', adminUser.email);
  }
}

createGlobalAdmin()
  .then(() => {
    console.log('Global admin ready.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to create global admin:', error);
    process.exit(1);
  });
