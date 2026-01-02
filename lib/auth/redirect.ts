import { db } from '@/db';
import { memberships } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function getDefaultRedirectUrl(userId: string, isInternal: boolean): Promise<string> {
  if (isInternal) {
    return '/app';
  }

  // For customer users, redirect to their org's subdomain portal
  const userMemberships = await db.query.memberships.findMany({
    where: eq(memberships.userId, userId),
    with: {
      organization: true,
    },
    limit: 1,
  });

  if (userMemberships.length > 0 && userMemberships[0].organization) {
    const org = userMemberships[0].organization;
    return `/s/${org.subdomain}/tickets`;
  }

  // Fallback if no org found
  return '/login?error=No organization access';
}
