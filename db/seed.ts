import dotenv from 'dotenv';
import { db } from './index';
import { organizations, users, memberships } from './schema';
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';

// Configuration - Update these to set new passwords
const NEW_PASSWORDS = {
  'ag@agrnetworks.com': 'Admin@AGR2025!',
  'help@agrnetworks.com': 'Help@AGR2025!',
};

async function seed() {
  dotenv.config({ path: '.env.local' });
  console.log('Starting seed...');

  // Reset/create ag@agrnetworks.com (Internal Admin)
  const agPasswordHash = await bcrypt.hash(NEW_PASSWORDS['ag@agrnetworks.com'], 10);
  const existingAg = await db.query.users.findFirst({
    where: eq(users.email, 'ag@agrnetworks.com'),
  });

  let agUser;
  if (existingAg) {
    await db
      .update(users)
      .set({
        passwordHash: agPasswordHash,
        name: 'AG Administrator',
        isInternal: true,
      })
      .where(eq(users.email, 'ag@agrnetworks.com'));
    agUser = await db.query.users.findFirst({
      where: eq(users.email, 'ag@agrnetworks.com'),
    });
    console.log('✓ Reset password for:', agUser?.email);
  } else {
    [agUser] = await db
      .insert(users)
      .values({
        email: 'ag@agrnetworks.com',
        name: 'AG Administrator',
        passwordHash: agPasswordHash,
        isInternal: true,
        emailVerified: new Date(),
      })
      .returning();
    console.log('✓ Created user:', agUser.email);
  }

  // Reset/create help@agrnetworks.com (Help Desk Agent)
  const helpPasswordHash = await bcrypt.hash(NEW_PASSWORDS['help@agrnetworks.com'], 10);
  const existingHelp = await db.query.users.findFirst({
    where: eq(users.email, 'help@agrnetworks.com'),
  });

  let helpUser;
  if (existingHelp) {
    await db
      .update(users)
      .set({
        passwordHash: helpPasswordHash,
        name: 'Help Desk Agent',
        isInternal: true,
      })
      .where(eq(users.email, 'help@agrnetworks.com'));
    helpUser = await db.query.users.findFirst({
      where: eq(users.email, 'help@agrnetworks.com'),
    });
    console.log('✓ Reset password for:', helpUser?.email);
  } else {
    [helpUser] = await db
      .insert(users)
      .values({
        email: 'help@agrnetworks.com',
        name: 'Help Desk Agent',
        passwordHash: helpPasswordHash,
        isInternal: true,
        emailVerified: new Date(),
      })
      .returning();
    console.log('✓ Created user:', helpUser.email);
  }

  // Create or get sample organization (optional - for testing)
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
    console.log('✓ Created organization:', org.name);
  } else {
    console.log('  Organization exists:', org.name);
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
    console.log('✓ Created unassigned intake organization');
  } else {
    console.log('  Unassigned intake organization exists');
  }

  console.log('\n=================================');
  console.log('Credentials (save these securely):');
  console.log('=================================');
  console.log('');
  console.log('Admin User:');
  console.log('  Email:    ag@agrnetworks.com');
  console.log('  Password:', NEW_PASSWORDS['ag@agrnetworks.com']);
  console.log('');
  console.log('Help Desk User:');
  console.log('  Email:    help@agrnetworks.com');
  console.log('  Password:', NEW_PASSWORDS['help@agrnetworks.com']);
  console.log('');
  console.log('=================================');
  console.log('Seed completed successfully!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
