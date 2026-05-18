import { requireInternalRole } from '@/lib/auth/permissions';
import { getOrganizations } from '@/lib/organizations/queries';
import { getInternalUsers } from '@/lib/users/queries';
import { ReportBuilder } from '@/components/reports/report-builder';
import { StandardReports } from '@/components/reports/standard-reports';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface SearchParams {
  orgId?: string;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireInternalRole();
  const [organizationsList, internalUsers] = await Promise.all([
    getOrganizations(),
    getInternalUsers(),
  ]);

  const params = await searchParams;
  const defaultOrgId = params.orgId || organizationsList[0]?.id;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <p className="mt-1 text-sm text-gray-600">
          View standard reports and create custom reports
        </p>
      </div>

      {/* Standard Reports */}
      {defaultOrgId && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Standard Reports</h2>
          <StandardReports orgId={defaultOrgId} />
        </section>
      )}

      {/* Custom Report Builder */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Custom Report Builder</h2>
        <ReportBuilder organizations={organizationsList} internalUsers={internalUsers} />
      </section>
    </div>
  );
}
