import { db } from './index';
import { organizations, users, memberships } from './schema';
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';

async function seed() {
  console.log('Starting seed...');

  // Create or update internal admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.email, 'admin@agr.com'),
  });

  let adminUser;
  if (existingAdmin) {
    await db
      .update(users)
      .set({
        passwordHash: adminPasswordHash,
        name: 'AGR Admin',
        isInternal: true,
      })
      .where(eq(users.email, 'admin@agr.com'));
    adminUser = await db.query.users.findFirst({
      where: eq(users.email, 'admin@agr.com'),
    });
    console.log('Updated admin user:', adminUser?.email);
  } else {
    [adminUser] = await db
      .insert(users)
      .values({
        email: 'admin@agr.com',
        name: 'AGR Admin',
        passwordHash: adminPasswordHash,
        isInternal: true,
        emailVerified: new Date(),
      })
      .returning();
    console.log('Created admin user:', adminUser.email);
  }

  // Create or get sample organization
  let org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, 'acme'),
  });

  if (!org) {
    [org] = await db
      .insert(organizations)
      .values({
        name: 'Acme Corporation',
        slug: 'acme',
        subdomain: 'acme',
      })
      .returning();
    console.log('Created organization:', org.name);
  } else {
    console.log('Organization already exists:', org.name);
  }

  // Create or update customer user
  const customerPasswordHash = await bcrypt.hash('customer123', 10);
  const existingCustomer = await db.query.users.findFirst({
    where: eq(users.email, 'customer@acme.com'),
  });

  let customerUser;
  if (existingCustomer) {
    await db
      .update(users)
      .set({
        passwordHash: customerPasswordHash,
        name: 'Acme Customer',
        isInternal: false,
      })
      .where(eq(users.email, 'customer@acme.com'));
    customerUser = await db.query.users.findFirst({
      where: eq(users.email, 'customer@acme.com'),
    });
    console.log('Updated customer user:', customerUser?.email);
  } else {
    [customerUser] = await db
      .insert(users)
      .values({
        email: 'customer@acme.com',
        name: 'Acme Customer',
        passwordHash: customerPasswordHash,
        isInternal: false,
        emailVerified: new Date(),
      })
      .returning();
    console.log('Created customer user:', customerUser.email);
  }

  // Create or get membership for customer user
  const existingMembership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, customerUser!.id),
      eq(memberships.orgId, org!.id)
    ),
  });

  if (!existingMembership) {
    await db.insert(memberships).values({
      userId: customerUser!.id,
      orgId: org!.id,
      role: 'CUSTOMER_ADMIN',
    });
    console.log('Created membership for customer user');
  } else {
    console.log('Membership already exists');
  }

  // Create "Unassigned Intake" org for public tickets if it doesn't exist
  const intakeOrg = await db.query.organizations.findFirst({
    where: eq(organizations.slug, 'unassigned-intake'),
  });

  if (!intakeOrg) {
    await db.insert(organizations).values({
      name: 'Unassigned Intake',
      slug: 'unassigned-intake',
      subdomain: 'intake',
    });
    console.log('Created unassigned intake organization');
  } else {
    console.log('Unassigned intake organization already exists');
  }

  console.log('Seed completed successfully!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
