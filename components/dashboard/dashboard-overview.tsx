import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardMetrics } from '@/lib/analytics/queries';
import { formatDate } from '@/lib/utils/date';

interface DashboardOverviewProps {
  metrics: DashboardMetrics;
  trends: Array<{ date: string; count: number }>;
}

export function DashboardOverview({ metrics, trends }: DashboardOverviewProps) {
  const resolutionRate =
    metrics.totalTickets > 0
      ? ((metrics.resolvedTickets / metrics.totalTickets) * 100).toFixed(1)
      : '0';

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Activity Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Tickets created (7 days)</span>
            <span className="font-medium">{metrics.recentActivity.ticketsCreated}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Comments added (7 days)</span>
            <span className="font-medium">{metrics.recentActivity.commentsAdded}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Resolution rate</span>
            <span className="font-medium">{resolutionRate}%</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {trends.slice(-7).map((trend) => (
              <div key={trend.date} className="flex items-center justify-between">
                <span className="text-gray-600">
                  {formatDate(trend.date)}
                </span>
                <span className="font-medium">{trend.count} tickets</span>
              </div>
            ))}
            {trends.length === 0 && (
              <p className="text-sm text-gray-500">No recent activity</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

