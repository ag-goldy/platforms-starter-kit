import { requireInternalAdmin } from '@/lib/auth/permissions';
import { getOpsMetrics } from '@/lib/monitoring/ops-metrics';
import { OpsDashboard } from '@/components/admin/ops-dashboard';

export default async function OpsDashboardPage() {
  await requireInternalAdmin();
  
  const metrics = await getOpsMetrics();
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Operations Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Real-time view of system health, failures, and operational issues
        </p>
      </div>
      
      <OpsDashboard metrics={metrics} />
    </div>
  );
}

