import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { OrganizationTeamManager } from '@/components/organizations/organization-team-manager';
import { Organization2FAPolicy } from '@/components/organizations/organization-2fa-policy';
import { OrganizationSLAPolicy } from '@/components/organizations/organization-sla-policy';
import { getPendingInvitations } from '@/lib/users/invitations';
import { getOrganizationMembersAction } from '@/app/app/actions/users';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireInternalRole();
  const resolvedParams = await params;
  const orgId = resolvedParams.id;

  const orgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  const org = orgs[0];

  if (!org) {
    notFound();
  }

  const [members, invitations] = await Promise.all([
    getOrganizationMembersAction(orgId),
    getPendingInvitations(orgId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/organizations" className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block">
          ← Back to organizations
        </Link>
        <h1 className="text-2xl font-bold">{org.name}</h1>
        <p className="text-sm text-gray-600">
          {org.subdomain}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Link
              href={`/app/organizations/${orgId}/automation`}
              className="block rounded-lg border bg-white p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Automation Rules</h3>
                  <p className="text-sm text-gray-600">
                    Configure automated workflows for this organization
                  </p>
                </div>
                <span className="text-gray-400">→</span>
              </div>
            </Link>
            <Link
              href={`/app/organizations/${orgId}/request-types`}
              className="block rounded-lg border bg-white p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Service Catalog</h3>
                  <p className="text-sm text-gray-600">
                    Configure request types and dynamic forms
                  </p>
                </div>
                <span className="text-gray-400">→</span>
              </div>
            </Link>
            <Link
              href={`/app/organizations/${orgId}/services`}
              className="block rounded-lg border bg-white p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Services</h3>
                  <p className="text-sm text-gray-600">
                    Define supported services and per-service SLA policies
                  </p>
                </div>
                <span className="text-gray-400">→</span>
              </div>
            </Link>
            <Link
              href={`/app/organizations/${orgId}/sites`}
              className="block rounded-lg border bg-white p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Sites & Areas</h3>
                  <p className="text-sm text-gray-600">
                    Manage locations and areas for this organization
                  </p>
                </div>
                <span className="text-gray-400">→</span>
              </div>
            </Link>
            <Link
              href={`/app/organizations/${orgId}/assets`}
              className="block rounded-lg border bg-white p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Assets</h3>
                  <p className="text-sm text-gray-600">
                    Maintain linked assets and infrastructure inventory
                  </p>
                </div>
                <span className="text-gray-400">→</span>
              </div>
            </Link>
            <Link
              href={`/app/organizations/${orgId}/notices`}
              className="block rounded-lg border bg-white p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Notices</h3>
                  <p className="text-sm text-gray-600">
                    Publish maintenance and known issue banners
                  </p>
                </div>
                <span className="text-gray-400">→</span>
              </div>
            </Link>
            <Organization2FAPolicy orgId={orgId} requireTwoFactor={org.requireTwoFactor || false} />
          </div>
        </CardContent>
      </Card>

      <OrganizationSLAPolicy
        orgId={orgId}
        currentPolicy={{
          slaResponseHoursP1: org.slaResponseHoursP1,
          slaResponseHoursP2: org.slaResponseHoursP2,
          slaResponseHoursP3: org.slaResponseHoursP3,
          slaResponseHoursP4: org.slaResponseHoursP4,
          slaResolutionHoursP1: org.slaResolutionHoursP1,
          slaResolutionHoursP2: org.slaResolutionHoursP2,
          slaResolutionHoursP3: org.slaResolutionHoursP3,
          slaResolutionHoursP4: org.slaResolutionHoursP4,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Team Management</CardTitle>
        </CardHeader>
        <CardContent>
          <OrganizationTeamManager
            orgId={orgId}
            orgName={org.name}
            members={members}
            invitations={invitations}
          />
        </CardContent>
      </Card>
    </div>
  );
}
