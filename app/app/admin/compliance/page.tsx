import { requireInternalAdmin } from '@/lib/auth/permissions';
import { getOrganizations } from '@/lib/organizations/queries';
import { ComplianceManager } from '@/components/compliance/compliance-manager';
import { notFound } from 'next/navigation';

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>;
}) {
  await requireInternalAdmin();
  const resolvedParams = await searchParams;
  const orgId = resolvedParams.orgId;

  const organizations = await getOrganizations();

  if (orgId) {
    const org = organizations.find((o) => o.id === orgId);
    if (!org) {
      notFound();
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Compliance & Data Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Export data, anonymize user data, and manage compliance requests
          </p>
        </div>

        <ComplianceManager orgId={orgId} orgName={org.name} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compliance & Data Management</h1>
        <p className="mt-1 text-sm text-gray-600">
          Select an organization to manage compliance
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {organizations.map((org) => (
          <a
            key={org.id}
            href={`/app/admin/compliance?orgId=${org.id}`}
            className="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <h3 className="font-semibold">{org.name}</h3>
            <p className="mt-1 text-sm text-gray-600">{org.slug}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

