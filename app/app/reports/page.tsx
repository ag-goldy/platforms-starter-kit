import { requireInternalRole } from '@/lib/auth/permissions';
import { getOrganizations } from '@/lib/organizations/queries';
import { getInternalUsers } from '@/lib/users/queries';
import { ReportBuilder } from '@/components/reports/report-builder';

export default async function ReportsPage() {
  await requireInternalRole();
  const [organizations, internalUsers] = await Promise.all([
    getOrganizations(),
    getInternalUsers(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Custom Reports</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create custom reports and export ticket data
        </p>
      </div>

      <ReportBuilder organizations={organizations} internalUsers={internalUsers} />
    </div>
  );
}

