import { requireInternalRole } from '@/lib/auth/permissions';
import { getSLAReportAction } from '@/app/app/actions/sla';
import { getOrganizations } from '@/lib/organizations/queries';
import { SLADashboard } from '@/components/sla/sla-dashboard';

export default async function SLAPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>;
}) {
  await requireInternalRole();
  const params = await searchParams;
  const [report, organizations] = await Promise.all([
    getSLAReportAction(params.orgId),
    getOrganizations(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SLA Report</h1>
        <p className="mt-1 text-sm text-gray-600">
          Service Level Agreement metrics and compliance
        </p>
      </div>

      <SLADashboard report={report} organizations={organizations} />
    </div>
  );
}

