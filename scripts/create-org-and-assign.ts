import dotenv from 'dotenv';
import { db } from '@/db';
import { organizations, memberships, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });

async function setup() {
  // Create organization
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
    console.log(`✅ Created organization: ${org.name}`);
  } else {
    console.log(`✅ Organization exists: ${org.name}`);
  }

  // Assign customer user to org
  const user = await db.query.users.findFirst({
    where: eq(users.email, 'agisthegoat49@gmail.com'),
  });

  if (!user) {
    console.log('❌ Customer user not found');
    return;
  }

  const existingMembership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  });

  if (!existingMembership) {
    await db.insert(memberships).values({
      userId: user.id,
      orgId: org.id,
      role: 'REQUESTER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✅ Assigned customer to ${org.name}`);
  } else {
    console.log('✅ Customer already has membership');
  }

  console.log('\n✨ Setup complete!');
}

setup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
