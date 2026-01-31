import { db } from '@/db';
import { memberships } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function getOrganizations() {
  return db.query.organizations.findMany({
    orderBy: (orgs, { asc }) => [asc(orgs.name)],
  });
}

/**
 * Get all customer admin email addresses for an organization
 */
export async function getCustomerAdminEmails(orgId: string): Promise<string[]> {
  const adminMemberships = await db.query.memberships.findMany({
    where: and(
      eq(memberships.orgId, orgId),
      eq(memberships.role, 'CUSTOMER_ADMIN'),
      eq(memberships.isActive, true)
    ),
    with: {
      user: {
        columns: {
          email: true,
        },
      },
    },
  });

  return adminMemberships
    .map((m) => m.user?.email)
    .filter((email): email is string => !!email);
}
