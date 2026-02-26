import { requireInternalRole } from '@/lib/auth/permissions';
import { getDashboardMetrics, getTicketTrends } from '@/lib/analytics/queries';
import { DashboardOverview } from '@/components/dashboard/dashboard-overview';
import { MetricsCards } from '@/components/dashboard/metrics-cards';
import { StatusDistribution } from '@/components/dashboard/status-distribution';
import { PriorityDistribution } from '@/components/dashboard/priority-distribution';
import { OrgDistribution } from '@/components/dashboard/org-distribution';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TicketIcon, Plus } from 'lucide-react';

export default async function DashboardPage() {
  await requireInternalRole();
  const [metrics, trends] = await Promise.all([
    getDashboardMetrics(),
    getTicketTrends(30),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Overview of ticket metrics and activity
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/tickets">
            <Button variant="outline">
              <TicketIcon className="w-4 h-4 mr-2" />
              View Tickets
            </Button>
          </Link>
          <Link href="/app/tickets/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Ticket
            </Button>
          </Link>
        </div>
      </div>

      <MetricsCards metrics={metrics} />
      <DashboardOverview metrics={metrics} trends={trends} />
      
      <div className="grid gap-6 md:grid-cols-2">
        <StatusDistribution data={metrics.ticketsByStatus} />
        <PriorityDistribution data={metrics.ticketsByPriority} />
      </div>

      <OrgDistribution data={metrics.ticketsByOrg} />
    </div>
  );
}

