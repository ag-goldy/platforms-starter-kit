import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { notices as noticesTable, organizations, sites as sitesTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NoticesManager } from '@/components/notices/notices-manager';

export default async function OrganizationNoticesPage({
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

  const [notices, sites] = await Promise.all([
    db.query.notices.findMany({
      where: eq(noticesTable.orgId, orgId),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      with: {
        site: true,
      },
    }),
    db.query.sites.findMany({
      where: eq(sitesTable.orgId, orgId),
      orderBy: (table, { asc }) => [asc(table.name)],
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/organizations/${orgId}`}
          className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
        >
          ← Back to organization
        </Link>
        <h1 className="text-2xl font-bold">Notices</h1>
        <p className="text-sm text-gray-600">
          Publish maintenance and incident banners for {org.name}
        </p>
      </div>

      <NoticesManager orgId={orgId} notices={notices as any} sites={sites} />
    </div>
  );
}
