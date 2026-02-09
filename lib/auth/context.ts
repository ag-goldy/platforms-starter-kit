import { auth } from '@/auth';
import { db } from '@/db';
import { memberships, organizations, users } from '@/db/schema';
import { getClientIP } from '@/lib/rate-limit';
import { rootDomain } from '@/lib/utils';
import { eq, and } from 'drizzle-orm';
import { headers } from 'next/headers';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { getSessionTokenFromCookie } from '@/lib/auth/session-tracking';

export type RequestContext = {
  user: typeof users.$inferSelect | null;
  isInternal: boolean;
  org: typeof organizations.$inferSelect | null;
  orgId: string | null;
  membership: typeof memberships.$inferSelect | null;
  subdomain: string | null;
  ip: string;
};

function extractSubdomain(host: string): string | null {
  const hostname = host.split(':')[0].toLowerCase();
  if (!hostname) return null;

  if (hostname.endsWith('.localhost')) {
    const parts = hostname.split('.');
    return parts.length > 1 ? parts[0] : null;
  }

  if (hostname.includes('---') && hostname.endsWith('.vercel.app')) {
    const parts = hostname.split('---');
    return parts.length > 0 ? parts[0] : null;
  }

  const root = rootDomain.split(':')[0].toLowerCase();
  if (!root || hostname === root || hostname === `www.${root}`) {
    return null;
  }

  if (hostname.endsWith(`.${root}`)) {
    return hostname.slice(0, -(root.length + 1));
  }

  return null;
}

export async function getRequestContext(): Promise<RequestContext> {
  const headersList = await headers();
  const host =
    headersList.get('x-forwarded-host') ||
    headersList.get('host') ||
    '';
  let subdomain = extractSubdomain(host);
  
  // If no subdomain from host, try to extract from URL path (/s/[subdomain]/...)
  if (!subdomain) {
    const referer = headersList.get('referer') || headersList.get('x-url') || '';
    const pathMatch = referer.match(/\/s\/([^/]+)/);
    if (pathMatch && pathMatch[1]) {
      subdomain = pathMatch[1];
    }
  }
  
  const ip = getClientIP(headersList);

  const session = await auth();
  let user: typeof users.$inferSelect | null = null;
  const sessionToken = await getSessionTokenFromCookie();

  if (!sessionToken && session?.user) {
    console.log('[RequestContext] Session exists but no token in cookie. Session user:', session.user.email);
  }

  // Look up user by ID first (more reliable), then by email as fallback
  if (session?.user?.id) {
    const foundUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });
    user = foundUser || null;
    
    if (!user) {
      console.log('[RequestContext] Session user ID not found in DB:', session.user.id, session.user.email);
    }
  } else if (session?.user?.email) {
    // Fallback to email lookup for older sessions that might not have ID
    const foundUser = await db.query.users.findFirst({
      where: eq(users.email, session.user.email),
    });
    user = foundUser || null;
    
    if (!user) {
      console.log('[RequestContext] Session user email not found in DB:', session.user.email);
    }
  } else {
    if (!session) {
      // Common case for unauthenticated users, but useful for debugging if expected to be logged in
      // console.log('[RequestContext] No session returned from auth()');
    }
  }

  let org: typeof organizations.$inferSelect | null = null;
  let membership: typeof memberships.$inferSelect | null = null;

  if (subdomain) {
    const foundOrg = await getOrgBySubdomain(subdomain);
    org = foundOrg || null;
  }

  if (user && org) {
    const foundMembership = await db.query.memberships.findFirst({
      where: and(eq(memberships.userId, user.id), eq(memberships.orgId, org.id)),
    });
    membership = foundMembership?.isActive ? foundMembership : null;
  }

  return {
    user,
    isInternal: !!user?.isInternal,
    org,
    orgId: org?.id ?? null,
    membership,
    subdomain,
    ip,
  };
}
