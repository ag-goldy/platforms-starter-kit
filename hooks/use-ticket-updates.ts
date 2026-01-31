'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface TicketUpdate {
  id: string;
  updatedAt: Date;
  commentCount: number;
  status: string;
  priority: string;
  assigneeId: string | null;
}

interface UseTicketUpdatesOptions {
  ticketId: string;
  currentUpdatedAt: Date | string;
  currentCommentCount: number;
  enabled?: boolean;
  onUpdate?: (update: TicketUpdate) => void;
  pollInterval?: number;
}

export function useTicketUpdates({
  ticketId,
  currentUpdatedAt,
  currentCommentCount,
  enabled = true,
  onUpdate,
  pollInterval = 5000, // 5 seconds
}: UseTicketUpdatesOptions) {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [update, setUpdate] = useState<TicketUpdate | null>(null);
  const initialUpdatedAt =
    currentUpdatedAt instanceof Date
      ? currentUpdatedAt
      : new Date(currentUpdatedAt);
  const lastUpdatedAtRef = useRef<Date>(initialUpdatedAt);
  const lastCommentCountRef = useRef<number>(currentCommentCount);
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(async () => {
      try {
        // We need to create a server action to fetch ticket updates
        // For now, we'll use a simple fetch to an API route
        const response = await fetch(`/api/tickets/${ticketId}/updates`, {
          cache: 'no-store',
        });

        if (!response.ok) return;

        const data = await response.json();
        const updatedAt = new Date(data.updatedAt);
        const commentCount = data.commentCount || 0;

        // Check if there's an update
        if (
          updatedAt > lastUpdatedAtRef.current ||
          commentCount > lastCommentCountRef.current
        ) {
          const newUpdate: TicketUpdate = {
            id: ticketId,
            updatedAt,
            commentCount,
            status: data.status,
            priority: data.priority,
            assigneeId: data.assigneeId,
          };

          setUpdate(newUpdate);
          setHasUpdate(true);
          lastUpdatedAtRef.current = updatedAt;
          lastCommentCountRef.current = commentCount;

          if (onUpdate) {
            onUpdate(newUpdate);
          }
        }
      } catch (error) {
        // Silently fail - don't spam console
        console.debug('Failed to check for ticket updates:', error);
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [ticketId, enabled, pollInterval, onUpdate]);

  const acknowledgeUpdate = () => {
    setHasUpdate(false);
    setUpdate(null);
    router.refresh(); // Refresh the page to get latest data
  };

  return {
    hasUpdate,
    update,
    acknowledgeUpdate,
  };
}

