'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Types
interface RealtimeMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// Simple EventSource-based real-time hook
export function useRealtime(channel: string) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<RealtimeMessage | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    setStatus('connecting');

    try {
      const es = new EventSource(`/api/realtime?channel=${encodeURIComponent(channel)}`);
      eventSourceRef.current = es;

      es.onopen = () => {
        setStatus('connected');
        setError(null);
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage({
            type: data.type,
            payload: data.payload,
            timestamp: Date.now(),
          });
        } catch (e) {
          console.error('Failed to parse realtime message:', e);
        }
      };

      es.onerror = (e) => {
        setStatus('error');
        setError(new Error('Realtime connection error'));
        es.close();

        // Auto reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };
    } catch (e) {
      setStatus('error');
      setError(e as Error);
    }
  }, [channel]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { status, lastMessage, error, reconnect: connect };
}

// Hook for ticket presence (who's viewing/editing)
export function useTicketPresence(ticketId: string) {
  const [activeUsers, setActiveUsers] = useState<
    Array<{
      userId: string;
      userName: string;
      userAvatar?: string;
      isEditing: boolean;
    }>
  >([]);
  const [isEditing, setIsEditing] = useState(false);
  const heartbeatRef = useRef<NodeJS.Timeout>();

  // Register presence
  useEffect(() => {
    const registerPresence = async () => {
      try {
        await fetch(`/api/tickets/${ticketId}/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isEditing }),
        });
      } catch (e) {
        console.error('Failed to register presence:', e);
      }
    };

    registerPresence();

    // Heartbeat every 30 seconds
    heartbeatRef.current = setInterval(registerPresence, 30000);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      // Unregister on unmount
      fetch(`/api/tickets/${ticketId}/presence`, {
        method: 'DELETE',
      }).catch(console.error);
    };
  }, [ticketId, isEditing]);

  // Poll for other users
  useEffect(() => {
    const fetchPresence = async () => {
      try {
        const res = await fetch(`/api/tickets/${ticketId}/presence`);
        if (res.ok) {
          const data = await res.json();
          setActiveUsers(data.users || []);
        }
      } catch (e) {
        console.error('Failed to fetch presence:', e);
      }
    };

    fetchPresence();
    const interval = setInterval(fetchPresence, 5000);

    return () => clearInterval(interval);
  }, [ticketId]);

  return { activeUsers, isEditing, setIsEditing };
}

// Hook for draft autosave
export function useDraftAutosave({
  ticketId,
  content,
  draftType = 'comment',
  debounceMs = 2000,
}: {
  ticketId?: string;
  content: string;
  draftType?: 'comment' | 'internal_note' | 'reply';
  debounceMs?: number;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [draft, setDraft] = useState<string>('');
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Load existing draft
  useEffect(() => {
    if (!ticketId) return;

    const loadDraft = async () => {
      try {
        const res = await fetch(
          `/api/tickets/${ticketId}/draft?type=${draftType}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.content) {
            setDraft(data.content);
            setLastSaved(new Date(data.lastSavedAt));
          }
        }
      } catch (e) {
        console.error('Failed to load draft:', e);
      }
    };

    loadDraft();
  }, [ticketId, draftType]);

  // Autosave
  useEffect(() => {
    if (!ticketId || !content.trim()) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await fetch(`/api/tickets/${ticketId}/draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, draftType }),
        });
        setLastSaved(new Date());
      } catch (e) {
        console.error('Failed to save draft:', e);
      } finally {
        setIsSaving(false);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, ticketId, draftType, debounceMs]);

  const clearDraft = useCallback(async () => {
    if (!ticketId) return;

    try {
      await fetch(`/api/tickets/${ticketId}/draft?type=${draftType}`, {
        method: 'DELETE',
      });
      setDraft('');
      setLastSaved(null);
    } catch (e) {
      console.error('Failed to clear draft:', e);
    }
  }, [ticketId, draftType]);

  return { isSaving, lastSaved, draft, clearDraft };
}

// Hook for optimistic updates
export function useOptimisticUpdate<T>(
  initialData: T,
  updateFn: (current: T, update: Partial<T>) => T
) {
  const [data, setData] = useState<T>(initialData);
  const [isPending, setIsPending] = useState(false);

  const optimisticUpdate = useCallback(
    async (update: Partial<T>, serverAction: () => Promise<void>) => {
      const previousData = data;
      
      // Optimistically update
      setData((current) => updateFn(current, update));
      setIsPending(true);

      try {
        await serverAction();
      } catch (e) {
        // Revert on error
        setData(previousData);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [data, updateFn]
  );

  return { data, setData, isPending, optimisticUpdate };
}

// Hook for infinite scroll
export function useInfiniteScroll<T>({
  fetchPage,
  hasNextPage,
}: {
  fetchPage: (page: number) => Promise<T[]>;
  hasNextPage: boolean;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasNextPage) return;

    setIsLoading(true);
    setError(null);

    try {
      const newItems = await fetchPage(page);
      setItems((prev) => [...prev, ...newItems]);
      setPage((p) => p + 1);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, hasNextPage, isLoading, page]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(element);

    return () => observerRef.current?.disconnect();
  }, [loadMore]);

  return { items, isLoading, error, loadMoreRef, refresh: () => {
    setItems([]);
    setPage(1);
  }};
}

// Hook for network status
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Get connection info if available
    const connection = (navigator as any).connection;
    if (connection) {
      setConnectionType(connection.effectiveType || 'unknown');
      connection.addEventListener('change', () => {
        setConnectionType(connection.effectiveType || 'unknown');
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, connectionType };
}

// Hook for visibility change
export function useVisibility() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return isVisible;
}

// Hook for polling
export function usePolling<T>(
  fetchFn: () => Promise<T>,
  intervalMs: number = 5000,
  options: {
    enabled?: boolean;
    onError?: (error: Error) => void;
  } = {}
) {
  const { enabled = true, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isVisible = useVisibility();

  useEffect(() => {
    if (!enabled) return;

    const poll = async () => {
      if (!isVisible) return; // Pause polling when tab is hidden

      setIsLoading(true);
      try {
        const result = await fetchFn();
        setData(result);
      } catch (e) {
        onError?.(e as Error);
      } finally {
        setIsLoading(false);
      }
    };

    poll();
    const interval = setInterval(poll, intervalMs);

    return () => clearInterval(interval);
  }, [fetchFn, intervalMs, enabled, isVisible, onError]);

  return { data, isLoading, refresh: () => fetchFn().then(setData) };
}
