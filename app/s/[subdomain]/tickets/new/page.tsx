import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { notFound } from 'next/navigation';
import { CustomerTicketForm } from '@/components/customer/ticket-form';
import { getRequestTypes } from '@/lib/request-types/queries';
import { db } from '@/db';
import { areas, assets, sites } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { CustomerRequestCatalog } from '@/components/customer/request-catalog';
import { getActiveNotices } from '@/lib/notices/queries';
import { getServicesByOrg } from '@/lib/services/queries';

export default async function CustomerNewTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { subdomain } = await params;
  const resolvedSearchParams = await searchParams;
  const serviceIdParam = resolvedSearchParams.serviceId;
  const defaultServiceId = typeof serviceIdParam === 'string' ? serviceIdParam : undefined;

  const org = await getOrgBySubdomain(subdomain);

  if (!org) {
    notFound();
  }

  try {
    const { membership } = await requireOrgMemberRole(org.id);
    const isAdmin = membership.role === 'CUSTOMER_ADMIN';

    const allServices = await getServicesByOrg(org.id);
    const services = allServices;

    const requestTypes = await getRequestTypes(org.id);
    if (requestTypes.length === 0) {
      return (
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Create Request</h1>
            <p className="mt-1 text-sm text-gray-600">
              Submit a new support request
            </p>
          </div>

          <CustomerTicketForm subdomain={subdomain} services={services} defaultServiceId={defaultServiceId} />
        </div>
      );
    }

    const orgSites = await db.query.sites.findMany({
      where: and(eq(sites.orgId, org.id), eq(sites.isActive, true)),
      orderBy: (table, { asc }) => [asc(table.name)],
    });
    const siteIds = orgSites.map((site) => site.id);
    const orgAreas = await db.query.areas.findMany({
      where: siteIds.length > 0 ? inArray(areas.siteId, siteIds) : undefined,
      orderBy: (table, { asc }) => [asc(table.name)],
    });
    const orgAssets = isAdmin
      ? await db.query.assets.findMany({
          where: eq(assets.orgId, org.id),
          orderBy: (table, { asc }) => [asc(table.name)],
        })
      : [];

    const notices = await getActiveNotices(org.id);
    const criticalNotice = notices.find(
      (notice) => notice.type === 'INCIDENT' && notice.severity === 'CRITICAL'
    );

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Create Request</h1>
          <p className="mt-1 text-sm text-gray-600">
            Choose a request type and provide the required details.
          </p>
        </div>

        <CustomerRequestCatalog
          subdomain={subdomain}
          requestTypes={requestTypes}
          sites={orgSites}
          areas={orgAreas}
          assets={orgAssets}
          services={services}
          isAdmin={isAdmin}
          criticalNotice={criticalNotice ? { title: criticalNotice.title, body: criticalNotice.body } : null}
        />
      </div>
    );
  } catch (error) {
    console.error('[CustomerNewTicketPage] Error:', error);
    // Not authenticated or not a member
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-full max-w-md text-center">
          <p className="text-sm text-gray-600">
            Please sign in to create a ticket.
          </p>
          <p className="text-xs text-red-500 mt-2">
            Debug: {(error as Error).message}
          </p>
        </div>
      </div>
    );
  }
}
