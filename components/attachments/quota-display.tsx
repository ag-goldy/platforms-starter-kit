'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatBytes } from '@/lib/attachments/quota';
import { AlertCircle } from 'lucide-react';

interface QuotaDisplayProps {
  usedBytes: number;
  quotaBytes: number;
  showWarning?: boolean;
}

export function QuotaDisplay({ usedBytes, quotaBytes, showWarning = true }: QuotaDisplayProps) {
  const usagePercent = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0;
  const availableBytes = Math.max(0, quotaBytes - usedBytes);
  const isExceeded = usedBytes >= quotaBytes;
  const isWarning = usagePercent >= 80 && !isExceeded;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Storage Usage
          {isExceeded && <AlertCircle className="h-4 w-4 text-destructive" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Used</span>
            <span className={isExceeded ? 'text-destructive font-semibold' : ''}>
              {formatBytes(usedBytes)} / {formatBytes(quotaBytes)}
            </span>
          </div>
          <Progress 
            value={Math.min(100, usagePercent)} 
            className={isExceeded ? 'bg-destructive' : isWarning ? 'bg-yellow-500' : ''}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{usagePercent.toFixed(1)}% used</span>
            <span>{formatBytes(availableBytes)} available</span>
          </div>
        </div>

        {showWarning && isExceeded && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            Storage quota exceeded. Please delete some attachments or contact your administrator to increase the quota.
          </div>
        )}

        {showWarning && isWarning && !isExceeded && (
          <div className="rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
            Storage usage is above 80%. Consider cleaning up old attachments.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

