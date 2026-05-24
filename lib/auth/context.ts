import { auth } from "@/auth";
import { db } from "@/db";
import { memberships, organizations, users, platformAdmins } from "@/db/schema";
import { getClientIP } from "@/lib/rate-limit";
import { rootDomain } from "@/lib/utils";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { getOrgBySubdomain } from "@/lib/subdomains/org-lookup";
import { getSessionTokenFromCookie } from "@/lib/auth/session-tracking";
import {
  getImpersonationState,
  type ImpersonationState,
} from "@/lib/admin/platform";

export type RequestContext = {
  user: typeof users.$inferSelect | null;
  platformAdmin: typeof platformAdmins.$inferSelect | null;
  isInternal: boolean;
  isPlatformAdmin: boolean;
  org: typeof organizations.$inferSelect | null;
  orgId: string | null;
  membership: typeof memberships.$inferSelect | null;
  subdomain: string | null;
  ip: string;
  impersonation: ImpersonationState | null;
};

function extractSubdomain(host: string): string | null {
  const hostname = host.split(":")[0].toLowerCase();
  if (!hostname) return null;

  if (hostname.endsWith(".localhost")) {
    const parts = hostname.split(".");
    return parts.length > 1 ? parts[0] : null;
  }

  if (hostname.includes("---") && hostname.endsWith(".vercel.app")) {
    const parts = hostname.split("---");
    return parts.length > 0 ? parts[0] : null;
  }

  const root = rootDomain.split(":")[0].toLowerCase();
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
    headersList.get("x-forwarded-host") || headersList.get("host") || "";
  let subdomain = extractSubdomain(host);

  // If no subdomain from host, try to extract from URL path (/s/[subdomain]/...)
  if (!subdomain) {
    const referer =
      headersList.get("referer") || headersList.get("x-url") || "";
    const pathMatch = referer.match(/\/s\/([^/]+)/);
    if (pathMatch && pathMatch[1]) {
      subdomain = pathMatch[1];
    }
  }

  const ip = getClientIP(headersList);

  const session = await auth();
  let user: typeof users.$inferSelect | null = null;
  let platformAdmin: typeof platformAdmins.$inferSelect | null = null;
  const sessionToken = await getSessionTokenFromCookie();
  const impersonation = await getImpersonationState();

  if (!sessionToken && session?.user) {
    // Session without cookie token — may indicate cookie loss or SSR context
  }

  // Look up user by ID first (more reliable), then by email as fallback
  let isPlatformAdmin = false;

  if (session?.user?.id) {
    const foundUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });
    user = foundUser || null;

    if (!user) {
      // Check if this is a platform admin (they're in a separate table)
      const foundPlatformAdmin = await db.query.platformAdmins.findFirst({
        where: eq(platformAdmins.id, session.user.id),
      });

      if (foundPlatformAdmin) {
        isPlatformAdmin = true;
        platformAdmin = foundPlatformAdmin;
      } else {
        // User ID from session not found in users or platform_admins — stale session
      }
    }
  } else if (session?.user?.email) {
    // Fallback to email lookup for older sessions that might not have ID
    const foundUser = await db.query.users.findFirst({
      where: eq(users.email, session.user.email),
    });
    user = foundUser || null;

    if (!user) {
      // Check if this is a platform admin
      const foundPlatformAdmin = await db.query.platformAdmins.findFirst({
        where: eq(platformAdmins.email, session.user.email),
      });

      if (foundPlatformAdmin) {
        isPlatformAdmin = true;
        platformAdmin = foundPlatformAdmin;
      } else {
        // Email fallback: not found in users or platform_admins — stale session
      }
    }
  } else {
    if (!session) {
      // Common case for unauthenticated users, but useful for debugging if expected to be logged in
      // console.log('[RequestContext] No session returned from auth()');
    }
  }

  let org: typeof organizations.$inferSelect | null = null;
  let membership: typeof memberships.$inferSelect | null = null;

  if (isPlatformAdmin && platformAdmin && impersonation) {
    const [impersonatedOrg, impersonatedUser, impersonatedMembership] =
      await Promise.all([
        db.query.organizations.findFirst({
          where: eq(organizations.id, impersonation.orgId),
        }),
        db.query.users.findFirst({
          where: eq(users.id, impersonation.userId),
        }),
        db.query.memberships.findFirst({
          where: and(
            eq(memberships.orgId, impersonation.orgId),
            eq(memberships.userId, impersonation.userId),
            eq(memberships.isActive, true),
          ),
        }),
      ]);

    if (impersonatedOrg && impersonatedUser && impersonatedMembership) {
      org = impersonatedOrg;
      user = impersonatedUser;
      membership = impersonatedMembership;
      subdomain = impersonatedOrg.subdomain;
    }
  }

  if (!org && subdomain) {
    const foundOrg = await getOrgBySubdomain(subdomain);
    org = foundOrg || null;

    // Check if organization is disabled and user is not internal
    // Internal users can still access disabled orgs for management
    if (org && !org.isActive && user && !user.isInternal) {
      org = null; // Hide org from customer users
    }
  }

  if (!membership && user && org) {
    const foundMembership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, user.id),
        eq(memberships.orgId, org.id),
      ),
    });
    membership = foundMembership?.isActive ? foundMembership : null;
  }

  return {
    user,
    platformAdmin,
    isInternal: !!user?.isInternal || isPlatformAdmin, // Platform admins are treated as internal
    isPlatformAdmin,
    org,
    orgId: org?.id ?? null,
    membership,
    subdomain,
    ip,
    impersonation,
  };
}
