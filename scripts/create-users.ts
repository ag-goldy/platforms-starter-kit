import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { users, memberships, organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });

const DEFAULT_PASSWORD = 'ChangeMe123!';

interface UserToCreate {
  email: string;
  name: string;
  isInternal: boolean;
  role: 'ADMIN' | 'AGENT' | 'REQUESTER';
  orgName?: string;
}

const usersToCreate: UserToCreate[] = [
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
    orgName: 'AGR Networks', // Will be assigned to this org
  },
];

async function createUsers() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const userData of usersToCreate) {
    try {
      // Check if user already exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, userData.email),
      });

      if (existingUser) {
        console.log(`User ${userData.email} already exists, skipping...`);
        continue;
      }

      // Create user
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

      console.log(`✅ Created user: ${newUser.email} (${newUser.name})`);

      // If org name specified, find org and create membership
      if (userData.orgName) {
        const org = await db.query.organizations.findFirst({
          where: eq(organizations.name, userData.orgName),
        });

        if (org) {
          await db
            .insert(memberships)
            .values({
              userId: newUser.id,
              orgId: org.id,
              role: userData.role,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoNothing();

          console.log(`   └─ Assigned to organization: ${org.name} (${userData.role})`);
        } else {
          console.log(`   ⚠️ Organization "${userData.orgName}" not found`);
          
          // Try to find any org to assign to
          const anyOrg = await db.query.organizations.findFirst();
          if (anyOrg) {
            await db
              .insert(memberships)
              .values({
                userId: newUser.id,
                orgId: anyOrg.id,
                role: userData.role,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .onConflictDoNothing();
            console.log(`   └─ Assigned to available organization: ${anyOrg.name} (${userData.role})`);
          }
        }
      }

      console.log(`   Password: ${DEFAULT_PASSWORD}`);
    } catch (error) {
      console.error(`❌ Failed to create user ${userData.email}:`, error);
    }
  }

  console.log('\n✨ Done! Users created successfully.');
  console.log(`\nDefault password for all accounts: ${DEFAULT_PASSWORD}`);
  console.log('\nUsers can log in at: http://localhost:3000/login');
}

createUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to create users:', error);
    process.exit(1);
  });
