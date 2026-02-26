import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CustomerTeamManager } from '@/components/customer/team-manager';
import { db } from '@/db';
import { memberships, users, userInvitations } from '@/db/schema';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { Users, Shield, Mail, Clock } from 'lucide-react';

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
    // Internal users are treated as admins; customer users need membership
    const isAdmin = !membership || membership.role === 'CUSTOMER_ADMIN';

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
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center">
              <Users className="w-6 h-6 text-orange-500" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Team Management</h1>
          </div>
          <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
            Manage your organization&apos;s team members and invitations
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{teamMembers.length}</p>
                <p className="text-sm text-gray-500 font-medium">Total Members</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{teamMembers.filter(m => m.role === 'CUSTOMER_ADMIN').length}</p>
                <p className="text-sm text-gray-500 font-medium">Admins</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pendingInvitations.length}</p>
                <p className="text-sm text-gray-500 font-medium">Pending Invites</p>
              </div>
            </div>
          </div>
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
    );
  } catch {
    // Not authenticated or not a member
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="w-full max-w-md border-gray-100 rounded-2xl shadow-sm">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-orange-500" />
            </div>
            <CardTitle className="text-xl font-bold text-gray-900">Access Required</CardTitle>
            <CardDescription className="text-gray-500">
              Please sign in to access team management.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <a href="/login" className="inline-flex items-center justify-center w-full bg-black hover:bg-gray-800 text-white h-11 rounded-xl font-medium transition-colors">
              Sign in to Continue
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }
}