import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { organizations, sites as sitesTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SitesManager } from '@/components/sites/sites-manager';

export default async function OrganizationSitesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireInternalRole();
  const { id: orgId } = await params;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) {
    notFound();
  }

  const sites = await db.query.sites.findMany({
    where: eq(sitesTable.orgId, orgId),
    orderBy: (table, { asc }) => [asc(table.name)],
    with: {
      areas: {
        orderBy: (areaTable, { asc }) => [asc(areaTable.name)],
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/organizations/${orgId}`}
          className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
        >
          ← Back to organization
        </Link>
        <h1 className="text-2xl font-bold">Sites & Areas</h1>
        <p className="text-sm text-gray-600">
          Manage locations and areas for {org.name}
        </p>
      </div>

      <SitesManager orgId={orgId} sites={sites} />
    </div>
  );
}
