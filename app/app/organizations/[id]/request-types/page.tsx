import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getRequestTypesAction } from '@/app/app/actions/request-types';
import { RequestTypesManager } from '@/components/request-types/request-types-manager';

export default async function OrganizationRequestTypesPage({
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

  const requestTypes = await getRequestTypesAction(orgId, true);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/organizations/${orgId}`}
          className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
        >
          ← Back to organization
        </Link>
        <h1 className="text-2xl font-bold">Service Catalog</h1>
        <p className="text-sm text-gray-600">
          Manage request types for {org.name}
        </p>
      </div>

      <RequestTypesManager orgId={orgId} requestTypes={requestTypes} />
    </div>
  );
}
