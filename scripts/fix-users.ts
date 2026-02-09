import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { users, memberships, organizations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });

const DEFAULT_PASSWORD = 'ChangeMe123!';

interface UserFix {
  email: string;
  name: string;
  isInternal: boolean;
  role: 'ADMIN' | 'AGENT' | 'REQUESTER';
}

const usersToFix: UserFix[] = [
  {
    email: 'ag@agrnetworks.com',
    name: 'AG Administrator',
    isInternal: true,
    role: 'ADMIN',
  },
  {
    email: 'help@agrnetworks.com',
    name: 'Help Desk Agent',
    isInternal: true,
    role: 'AGENT',
  },
  {
    email: 'agisthegoat49@gmail.com',
    name: 'Customer User',
    isInternal: false,
    role: 'REQUESTER',
  },
];

async function fixUsers() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // Get or create AGR Networks organization
  let org = await db.query.organizations.findFirst({
    where: eq(organizations.name, 'AGR Networks'),
  });

  if (!org) {
    const [newOrg] = await db
      .insert(organizations)
      .values({
        name: 'AGR Networks',
        slug: 'agr-networks',
        subdomain: 'agr',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    org = newOrg;
    console.log('✅ Created organization: AGR Networks');
  } else {
    console.log('✅ Found organization: AGR Networks');
  }

  for (const userData of usersToFix) {
    try {
      // Check if user exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, userData.email),
      });

      if (existingUser) {
        // Update password and ensure verified
        await db
          .update(users)
          .set({
            passwordHash,
            emailVerified: new Date(),
            isInternal: userData.isInternal,
            name: userData.name,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id));
        console.log(`✅ Updated user: ${userData.email}`);
      } else {
        // Create new user
        const [newUser] = await db
          .insert(users)
          .values({
            email: userData.email,
            name: userData.name,
            passwordHash,
            isInternal: userData.isInternal,
            emailVerified: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        console.log(`✅ Created user: ${userData.email}`);
      }

      // Get the user (either updated or created)
      const user = await db.query.users.findFirst({
        where: eq(users.email, userData.email),
      });

      if (!user) {
        console.error(`❌ Failed to get user: ${userData.email}`);
        continue;
      }

      // Check membership
      const existingMembership = await db.query.memberships.findFirst({
        where: and(
          eq(memberships.userId, user.id),
          eq(memberships.orgId, org.id)
        ),
      });

      if (!existingMembership) {
        await db
          .insert(memberships)
          .values({
            userId: user.id,
            orgId: org.id,
            role: userData.role,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoNothing();
        console.log(`   └─ Assigned to ${org.name} as ${userData.role}`);
      } else {
        // Update role if needed
        await db
          .update(memberships)
          .set({ role: userData.role, isActive: true })
          .where(and(
            eq(memberships.userId, user.id),
            eq(memberships.orgId, org.id)
          ));
        console.log(`   └─ Updated role to ${userData.role}`);
      }
    } catch (error) {
      console.error(`❌ Failed to fix user ${userData.email}:`, error);
    }
  }

  console.log('\n✨ All users fixed!');
  console.log(`\nLogin credentials:`);
  console.log(`- Administrator: ag@agrnetworks.com / ${DEFAULT_PASSWORD}`);
  console.log(`- Agent: help@agrnetworks.com / ${DEFAULT_PASSWORD}`);
  console.log(`- Customer: agisthegoat49@gmail.com / ${DEFAULT_PASSWORD}`);
}

fixUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
