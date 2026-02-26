'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ServicesRefreshProps {
  children: React.ReactNode;
  refreshInterval?: number;
}

export function ServicesRefresh({ children, refreshInterval = 30000 }: ServicesRefreshProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const handleRefresh = () => {
    setIsRefreshing(true);
    setLastRefresh(new Date());
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Last updated:</span>
          <span className="font-medium">{lastRefresh.toLocaleTimeString()}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      {children}
    </div>
  );
}
