import dotenv from 'dotenv';
import { db } from '@/db';
import { organizations, memberships, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });

async function assignCustomerToOrg() {
  // Find customer user
  const user = await db.query.users.findFirst({
    where: eq(users.email, 'agisthegoat49@gmail.com'),
  });
  
  if (!user) {
    console.log('❌ User not found');
    return;
  }
  
  // Find any organization
  const org = await db.query.organizations.findFirst();
  
  if (!org) {
    console.log('❌ No organization found');
    return;
  }
  
  // Check if membership exists
  const existing = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  });
  
  if (existing) {
    console.log('✅ User already has membership');
    return;
  }
  
  // Create membership
  await db.insert(memberships).values({
    userId: user.id,
    orgId: org.id,
    role: 'REQUESTER',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  console.log(`✅ Assigned customer to organization: ${org.name}`);
}

assignCustomerToOrg()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
