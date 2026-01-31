import { notFound } from 'next/navigation';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { CustomerPortalShell } from '@/components/customer/portal-shell';
import { CustomerExportManager } from '@/components/customer/export-manager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getOrgExportRequestsAction } from '@/app/s/[subdomain]/actions/exports';

export default async function CustomerExportsPage({
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
    await requireOrgMemberRole(org.id, ['CUSTOMER_ADMIN']);
    const requests = await getOrgExportRequestsAction(org.id);

    return (
      <CustomerPortalShell subdomain={subdomain}>
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Data Exports</h1>
            <p className="text-sm text-gray-600">
              Request and download organization data exports.
            </p>
          </div>

          <CustomerExportManager orgId={org.id} requests={requests} />
        </div>
      </CustomerPortalShell>
    );
  } catch {
    return (
      <CustomerPortalShell subdomain={subdomain}>
        <div className="flex items-center justify-center py-12">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Access Required</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Customer admins can request data exports.
              </p>
            </CardContent>
          </Card>
        </div>
      </CustomerPortalShell>
    );
  }
}
