import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') }); // Fallback
import { db } from './index';
import { platformAdmins, users, organizations, orgSettings, memberships, teams } from './schema/index';
import * as bcrypt from 'bcryptjs';

async function main() {
  console.log('Seeding database...');

  try {
    // Clean up existing data for seed
    await db.delete(platformAdmins).execute();
    await db.delete(organizations).execute();
    await db.delete(users).execute();

    const hashedPassword = await bcrypt.hash('Password123!', 10);

    // 1. Platform Super Admin
    console.log('Creating platform super-admin...');
    await db.insert(platformAdmins).values({
      email: 'admin@atlas.com',
      hashedPassword,
      role: 'SUPER_ADMIN',
      status: 'active',
    }).execute();

    // 2. Demo Organization
    console.log('Creating demo organization...');
    const [org] = await db.insert(organizations).values({
      name: 'Acme Corp',
      slug: 'acme',
      status: 'active',
      plan: 'pro',
    }).returning().execute();

    await db.insert(orgSettings).values({
      orgId: org.id,
      brandingJson: { primaryColor: '#FF6600' },
      featuresJson: { kbEnabled: true, assetsEnabled: true },
    }).execute();

    // 3. Team
    const [team] = await db.insert(teams).values({
      orgId: org.id,
      name: 'IT Support',
    }).returning().execute();

    // 4. Owner User
    console.log('Creating owner user...');
    const [owner] = await db.insert(users).values({
      email: 'owner@acme.com',
      hashedPassword,
      status: 'active',
    }).returning().execute();

    await db.insert(memberships).values({
      userId: owner.id,
      orgId: org.id,
      role: 'owner',
      teamId: team.id,
    }).execute();

    console.log('✅ Seed completed successfully.');
    console.log('Login with: admin@atlas.com / Password123!');
    console.log('Login with: owner@acme.com / Password123!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
