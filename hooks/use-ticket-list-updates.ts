'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface TicketListUpdate {
  ticketId: string;
  updatedAt: Date;
  status?: string;
  priority?: string;
}

interface UseTicketListUpdatesOptions {
  ticketIds: string[];
  enabled?: boolean;
  onUpdate?: (updates: TicketListUpdate[]) => void;
  pollInterval?: number;
}

export function useTicketListUpdates({
  ticketIds,
  enabled = true,
  onUpdate,
  pollInterval = 10000, // 10 seconds for list view
}: UseTicketListUpdatesOptions) {
  const [hasUpdates, setHasUpdates] = useState(false);
  const [updates, setUpdates] = useState<TicketListUpdate[]>([]);
  const router = useRouter();

  const ticketIdsKey = ticketIds.join(',');

  useEffect(() => {
    if (!enabled || ticketIds.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/tickets/updates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketIds }),
          cache: 'no-store',
        });

        if (!response.ok) return;

        const data = await response.json();
        const newUpdates: TicketListUpdate[] = data.updates || [];

        if (newUpdates.length > 0) {
          setUpdates(newUpdates);
          setHasUpdates(true);

          if (onUpdate) {
            onUpdate(newUpdates);
          }
        }
      } catch (error) {
        // Silently fail
        console.debug('Failed to check for ticket list updates:', error);
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [ticketIdsKey, ticketIds, enabled, pollInterval, onUpdate]);

  const acknowledgeUpdates = () => {
    setHasUpdates(false);
    setUpdates([]);
    router.refresh();
  };

  return {
    hasUpdates,
    updates,
    acknowledgeUpdates,
  };
}

