import { notFound } from 'next/navigation';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { CustomerPortalShell } from '@/components/customer/portal-shell';
import { getServicesByOrg } from '@/lib/services/queries';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default async function CustomerServicesPage({
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
    await requireOrgMemberRole(org.id);
    const items = await getServicesByOrg(org.id);
    return (
      <CustomerPortalShell subdomain={subdomain}>
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Services</h1>
          </div>
          <div className="space-y-3">
            {items.length === 0 ? (
              <p className="text-sm text-gray-600">No services available.</p>
            ) : (
              items.map((svc) => (
                <div key={svc.id} className="rounded-md border p-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{svc.name}</span>
                      <Badge variant="outline">{svc.status}</Badge>
                      {svc.isUnderContract ? <Badge variant="secondary">Managed</Badge> : <Badge variant="outline">Best-effort</Badge>}
                    </div>
                    {svc.description ? (
                      <p className="text-xs text-gray-600 mt-1">{svc.description}</p>
                    ) : null}
                  </div>
                  <Link href={`/s/${subdomain}/tickets/new`} className="text-sm text-primary hover:underline">
                    Create ticket
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </CustomerPortalShell>
    );
  } catch {
    return (
      <CustomerPortalShell subdomain={subdomain}>
        <div className="mx-auto max-w-md py-12">
          <p className="text-sm text-gray-600">Please sign in to view services.</p>
        </div>
      </CustomerPortalShell>
    );
  }
}

