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
import { useCallback, useEffect } from 'react';
import { clearFastDataCache } from '@/hooks/use-fast-data';

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

interface DashboardHybridProps {
  initialData: DashboardData;
}

async function fetchDashboardData(): Promise<DashboardData> {
  const response = await fetch('/api/dashboard/metrics');
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data');
  }
  return response.json();
}

export function DashboardHybrid({ initialData }: DashboardHybridProps) {
  // Seed the cache with server data immediately
  useEffect(() => {
    // Clear old cache to ensure fresh data on hard refresh
    // But keep it for client-side navigation
    const hasCache = sessionStorage.getItem('dashboard:seeded');
    if (!hasCache) {
      clearFastDataCache('dashboard:main');
      sessionStorage.setItem('dashboard:seeded', 'true');
    }
  }, []);

  const { data, isLoading, error, isStale, refetch } = useFastData<DashboardData>(
    'dashboard:main',
    fetchDashboardData,
    { 
      ttlMs: 60000, // 1 minute cache
      enabled: true,
      initialData, // Use server data initially
    }
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Use initial data while loading (for instant display)
  const displayData = data || initialData;

  if (error && !displayData) {
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

  const { metrics, trends } = displayData;

  return (
    <div className="space-y-6">
      {/* Stale/Loading indicator */}
      {(isStale || isLoading) && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <span className="text-sm text-blue-700">
            {isLoading ? 'Refreshing data...' : 'Updating dashboard...'}
          </span>
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
