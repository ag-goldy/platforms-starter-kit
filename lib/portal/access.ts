import { redirect } from "next/navigation";
import { and, eq, or } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { memberships, organizations } from "@/db/schema";

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
