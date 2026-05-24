import { redirect } from "next/navigation";
import { and, eq, or } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { memberships, organizations, users } from "@/db/schema";
import { getImpersonationState } from "@/lib/admin/platform";

export async function getOrgByPortalSlug(slug: string) {
  return db.query.organizations.findFirst({
    where: or(eq(organizations.slug, slug), eq(organizations.subdomain, slug)),
  });
}

export async function requirePortalAccess(slug: string) {
  const org = await getOrgByPortalSlug(slug);
  if (!org || !org.isActive || org.deletedAt) {
    return null;
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/s/${slug}`);
  }

  const impersonation = session.user.isPlatformAdmin
    ? await getImpersonationState()
    : null;
  if (impersonation?.orgId === org.id) {
    const [impersonatedUser, impersonatedMembership] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, impersonation.userId),
      }),
      db.query.memberships.findFirst({
        where: and(
          eq(memberships.orgId, org.id),
          eq(memberships.userId, impersonation.userId),
          eq(memberships.isActive, true),
        ),
      }),
    ]);

    if (impersonatedUser && impersonatedMembership) {
      return {
        org,
        user: impersonatedUser,
        membership: impersonatedMembership,
        isCustomerAdmin: impersonatedMembership.role === "CUSTOMER_ADMIN",
      };
    }
  }

  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.orgId, org.id),
      eq(memberships.userId, session.user.id),
      eq(memberships.isActive, true),
    ),
  });

  if (!membership && !session.user.isPlatformAdmin) {
    redirect("/login?error=AccessDenied");
  }

  return {
    org,
    user: session.user,
    membership,
    isCustomerAdmin:
      membership?.role === "CUSTOMER_ADMIN" || session.user.isPlatformAdmin,
  };
}
