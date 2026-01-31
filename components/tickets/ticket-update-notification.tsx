'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, X } from 'lucide-react';
import { useTicketUpdates } from '@/hooks/use-ticket-updates';
import { formatDateTime } from '@/lib/utils/date';

interface TicketUpdateNotificationProps {
  ticketId: string;
  currentUpdatedAt: Date;
  currentCommentCount: number;
}

export function TicketUpdateNotification({
  ticketId,
  currentUpdatedAt,
  currentCommentCount,
}: TicketUpdateNotificationProps) {
  const { hasUpdate, update, acknowledgeUpdate } = useTicketUpdates({
    ticketId,
    currentUpdatedAt,
    currentCommentCount,
    enabled: true,
  });

  if (!hasUpdate || !update) {
    return null;
  }

  const hasNewComments = update.commentCount > currentCommentCount;
  const message = hasNewComments
    ? `${update.commentCount - currentCommentCount} new comment${
        update.commentCount - currentCommentCount > 1 ? 's' : ''
      }`
    : 'Ticket has been updated';

  return (
    <Card className="mb-4 border-blue-200 bg-blue-50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-900">{message}</p>
            <p className="text-xs text-blue-700">
              Updated {formatDateTime(update.updatedAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={acknowledgeUpdate}
            className="h-8 text-blue-700 hover:text-blue-900"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              acknowledgeUpdate();
            }}
            className="h-8 text-blue-700 hover:text-blue-900"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

