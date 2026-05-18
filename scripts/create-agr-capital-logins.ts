import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { organizations, users, memberships } from "../db/schema";

dotenv.config({ path: ".env.local" });

const TEMP_PASSWORD = "ChangeMe123!";
const ORG_NAME = "AGR Capital Group";
const ORG_SLUG = "agr-capital-group";
const ORG_SUBDOMAIN = "agrcapitalgroup";

type RequestedUser = {
  email: string;
  name: string;
  isInternal: boolean;
  role: "AGENT" | "REQUESTER";
};

const requestedUsers: RequestedUser[] = [
  {
    email: "help@agrnetworks.com",
    name: "Help Desk Agent",
    isInternal: true,
    role: "AGENT",
  },
  {
    email: "agisthegoat49@gmail.com",
    name: "AGR Capital Group Customer",
    isInternal: false,
    role: "REQUESTER",
  },
];

async function ensureOrganization() {
  const existingByName = await db.query.organizations.findFirst({
    where: eq(organizations.name, ORG_NAME),
  });

  if (existingByName) {
    console.log(`✅ Organization exists: ${existingByName.name}`);
    return existingByName;
  }

  const [org] = await db
    .insert(organizations)
    .values({
      name: ORG_NAME,
      slug: ORG_SLUG,
      subdomain: ORG_SUBDOMAIN,
      platformRegion: "sg",
      allowPublicIntake: true,
      autoReplyEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  console.log(`✅ Created organization: ${org.name}`);
  return org;
}

async function ensureUser(
  orgId: string,
  userData: RequestedUser,
  passwordHash: string,
) {
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, userData.email),
  });

  let userId: string;

  if (existingUser) {
    await db
      .update(users)
      .set({
        name: userData.name,
        passwordHash,
        isInternal: userData.isInternal,
        emailVerified: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id));

    userId = existingUser.id;
    console.log(`✅ Updated user: ${userData.email}`);
  } else {
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

    userId = newUser.id;
    console.log(`✅ Created user: ${userData.email}`);
  }

  const existingMembership = await db.query.memberships.findFirst({
    where: and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)),
  });

  if (existingMembership) {
    await db
      .update(memberships)
      .set({
        role: userData.role,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(memberships.id, existingMembership.id));

    console.log(`   └─ Updated membership: ${userData.role}`);
  } else {
    await db.insert(memberships).values({
      userId,
      orgId,
      role: userData.role,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`   └─ Added membership: ${userData.role}`);
  }
}

async function main() {
  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);
  const org = await ensureOrganization();

  for (const userData of requestedUsers) {
    await ensureUser(org.id, userData, passwordHash);
  }

  console.log("\n✨ Requested logins are ready.");
  console.log(`Organization: ${ORG_NAME}`);
  console.log(`Agent: help@agrnetworks.com / ${TEMP_PASSWORD}`);
  console.log(`Customer: agisthegoat49@gmail.com / ${TEMP_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed to create requested logins:", error);
    process.exit(1);
  });
