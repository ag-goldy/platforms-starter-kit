import { requireInternalRole } from '@/lib/auth/permissions';
import { getDashboardMetrics, getTicketTrends } from '@/lib/analytics/queries';
import { DashboardHybrid } from './dashboard-hybrid';

export default async function DashboardPage() {
  await requireInternalRole();
  
  // Fetch initial data on server for fast first load
  const [metrics, trends] = await Promise.all([
    getDashboardMetrics(),
    getTicketTrends(30),
  ]);

  return <DashboardHybrid initialData={{ metrics, trends }} />;
}
