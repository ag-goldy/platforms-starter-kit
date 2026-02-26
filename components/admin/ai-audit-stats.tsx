'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, AlertTriangle, Filter, Clock } from 'lucide-react';
import { getAIAuditStatsAction } from '@/app/app/actions/ai-audit';

interface Stats {
  totalQueries: number;
  piiDetected: number;
  filtered: number;
  avgResponseTime: number;
  byInterface: { interface: string; count: number }[];
}

export function AIAuditStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getAIAuditStatsAction({
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        });
        setStats(data);
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="h-32 animate-pulse bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const piiRate = stats.totalQueries > 0 ? (stats.piiDetected / stats.totalQueries * 100).toFixed(1) : '0';
  const filterRate = stats.totalQueries > 0 ? (stats.filtered / stats.totalQueries * 100).toFixed(1) : '0';

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Total Queries (24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalQueries.toLocaleString()}</div>
          <div className="flex gap-2 mt-2">
            {stats.byInterface.map((item) => (
              <Badge key={item.interface} variant="outline" className="text-xs">
                {item.interface}: {item.count}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            PII Detected
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.piiDetected}</div>
          <p className="text-sm text-gray-500 mt-1">
            {piiRate}% of queries
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtered Responses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.filtered}</div>
          <p className="text-sm text-gray-500 mt-1">
            {filterRate}% of queries
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Avg Response Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.avgResponseTime}ms</div>
          <p className="text-sm text-gray-500 mt-1">
            Target: &lt;2000ms
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
