
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from '../db';
import { users, organizations, memberships } from '../db/schema';
import { eq, and } from 'drizzle-orm';

async function debugCustomerAccess() {
  console.log('Debugging Customer Access...\n');

  // 1. Find User
  const user = await db.query.users.findFirst({
    where: eq(users.email, 'customer@acme.com'),
  });

  if (!user) {
    console.error('User customer@acme.com not found!');
    process.exit(1);
  }
  console.log(`User: ${user.email} (${user.id})`);

  // 2. Find Org
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, 'acme'),
  });

  if (!org) {
    console.error('Organization acme not found!');
    process.exit(1);
  }
  console.log(`Organization: ${org.name} (${org.id})`);

  // 3. Check Membership
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, user.id),
      eq(memberships.orgId, org.id)
    ),
  });

  if (membership) {
    console.log(`Membership found:`);
    console.log(`  Role: ${membership.role}`);
    console.log(`  Is Active: ${membership.isActive}`);
  } else {
    console.error('No membership found for this user in this organization.');
  }

  process.exit(0);
}

debugCustomerAccess();
