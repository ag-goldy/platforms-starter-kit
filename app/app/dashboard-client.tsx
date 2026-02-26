'use client';

import { useFastData } from '@/hooks/use-fast-data';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { MetricsCards } from '@/components/dashboard/metrics-cards';
import { DashboardOverview } from '@/components/dashboard/dashboard-overview';
import { StatusDistribution } from '@/components/dashboard/status-distribution';
import { PriorityDistribution } from '@/components/dashboard/priority-distribution';
import { OrgDistribution } from '@/components/dashboard/org-distribution';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TicketIcon, Plus, RefreshCw } from 'lucide-react';
import { useCallback } from 'react';

interface DashboardData {
  metrics: {
    totalTickets: number;
    openTickets: number;
    resolvedTickets: number;
    ticketsByStatus: Array<{ status: string; count: number }>;
    ticketsByPriority: Array<{ priority: string; count: number }>;
    ticketsByOrg: Array<{ orgName: string; count: number }>;
    recentActivity: {
      ticketsCreated: number;
      commentsAdded: number;
    };
  };
  trends: Array<{ date: string; count: number }>;
}

async function fetchDashboardData(): Promise<DashboardData> {
  const response = await fetch('/api/dashboard/metrics');
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data');
  }
  return response.json();
}

export function DashboardClient() {
  const { data, isLoading, error, isStale, refetch } = useFastData<DashboardData>(
    'dashboard:main',
    fetchDashboardData,
    { 
      ttlMs: 60000, // 1 minute cache
      enabled: true,
    }
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading && !data) {
    return <DashboardSkeleton />;
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-red-600 mb-4">Failed to load dashboard</p>
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  if (!data) {
    return <DashboardSkeleton />;
  }

  const { metrics, trends } = data;

  return (
    <div className="space-y-6">
      {/* Stale indicator */}
      {isStale && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <span className="text-sm text-blue-700">Dashboard data is refreshing...</span>
          <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Overview of ticket metrics and activity
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
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
