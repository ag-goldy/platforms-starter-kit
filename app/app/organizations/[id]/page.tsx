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
import { Settings, Workflow, FileText, Layers, MapPin, Server, Bell, Shield, Users } from 'lucide-react';

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
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <nav className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Link
              href={`/app/organizations/${orgId}/automation`}
              className="flex items-start gap-3 rounded-lg border p-4 hover:bg-gray-50 transition-colors"
            >
              <Workflow className="h-5 w-5 text-gray-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-sm">Automation Rules</h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Configure automated workflows
                </p>
              </div>
            </Link>
            <Link
              href={`/app/organizations/${orgId}/request-types`}
              className="flex items-start gap-3 rounded-lg border p-4 hover:bg-gray-50 transition-colors"
            >
              <FileText className="h-5 w-5 text-gray-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-sm">Service Catalog</h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Request types and dynamic forms
                </p>
              </div>
            </Link>
            <Link
              href={`/app/organizations/${orgId}/services`}
              className="flex items-start gap-3 rounded-lg border p-4 hover:bg-gray-50 transition-colors"
            >
              <Layers className="h-5 w-5 text-gray-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-sm">Services</h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Services and SLA policies
                </p>
              </div>
            </Link>
            <Link
              href={`/app/organizations/${orgId}/sites`}
              className="flex items-start gap-3 rounded-lg border p-4 hover:bg-gray-50 transition-colors"
            >
              <MapPin className="h-5 w-5 text-gray-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-sm">Sites & Areas</h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Manage locations and areas
                </p>
              </div>
            </Link>
            <Link
              href={`/app/organizations/${orgId}/assets`}
              className="flex items-start gap-3 rounded-lg border p-4 hover:bg-gray-50 transition-colors"
            >
              <Server className="h-5 w-5 text-gray-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-sm">Assets</h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Infrastructure inventory
                </p>
              </div>
            </Link>
            <Link
              href={`/app/organizations/${orgId}/notices`}
              className="flex items-start gap-3 rounded-lg border p-4 hover:bg-gray-50 transition-colors"
            >
              <Bell className="h-5 w-5 text-gray-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-sm">Notices</h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Maintenance and issue banners
                </p>
              </div>
            </Link>
          </nav>
          <div className="mt-4 pt-4 border-t">
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
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Management
          </CardTitle>
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
