import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CustomerPortalShell } from '@/components/customer/portal-shell';
import { CustomerTeamManager } from '@/components/customer/team-manager';
import { db } from '@/db';
import { memberships, users, userInvitations } from '@/db/schema';
import { eq, and, isNull, gt } from 'drizzle-orm';

export default async function CustomerTeamPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const org = await getOrgBySubdomain(subdomain);

  if (!org) {
    notFound();
  }

  try {
    const { user, membership } = await requireOrgMemberRole(org.id);
    const isAdmin = membership.role === 'CUSTOMER_ADMIN';

    // Get team members
    const teamConditions = [eq(memberships.orgId, org.id)];
    if (!isAdmin) {
      teamConditions.push(eq(memberships.isActive, true));
    }

    const teamMembers = await db
      .select({
        membershipId: memberships.id,
        id: users.id,
        email: users.email,
        name: users.name,
        role: memberships.role,
        isActive: memberships.isActive,
        deactivatedAt: memberships.deactivatedAt,
        createdAt: users.createdAt,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(and(...teamConditions));

    // Get pending invitations (only for admins)
    let pendingInvitations: Array<{
      id: string;
      email: string;
      role: string;
      expiresAt: Date;
    }> = [];
    
    if (isAdmin) {
      pendingInvitations = await db
        .select({
          id: userInvitations.id,
          email: userInvitations.email,
          role: userInvitations.role,
          expiresAt: userInvitations.expiresAt,
        })
        .from(userInvitations)
        .where(
          and(
            eq(userInvitations.orgId, org.id),
            isNull(userInvitations.acceptedAt),
            gt(userInvitations.expiresAt, new Date())
          )
        );
    }

    return (
      <CustomerPortalShell subdomain={subdomain}>
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Team</h1>
            <p className="text-sm text-gray-600">
              Manage your organization&apos;s team members
            </p>
          </div>

          <CustomerTeamManager
            orgId={org.id}
            orgName={org.name}
            subdomain={subdomain}
            members={teamMembers}
            pendingInvitations={pendingInvitations}
            currentUserId={user.id}
            isAdmin={isAdmin}
          />
        </div>
      </CustomerPortalShell>
    );
  } catch {
    // Not authenticated or not a member
    return (
      <CustomerPortalShell subdomain={subdomain}>
        <div className="flex items-center justify-center py-12">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Access Required</CardTitle>
              <CardDescription>
                Please sign in to access team management.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a href="/login" className="text-blue-600 hover:underline">
                Sign in
              </a>
            </CardContent>
          </Card>
        </div>
      </CustomerPortalShell>
    );
  }
}
