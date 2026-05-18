'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

type ConnectionStatus = 'connecting' | 'connected' | 'fallback' | 'disconnected' | 'error';

export function useSocketRealtime<TPayload = Record<string, unknown>>({
  orgId,
  channel,
  events,
  onEvent,
}: {
  orgId: string;
  channel: string;
  events: string[];
  onEvent: (event: string, payload: TPayload) => void;
}) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const socketRef = useRef<Socket | null>(null);
  const callbackRef = useRef(onEvent);

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!orgId || !channel) return;

    const socketUrl = process.env.NEXT_PUBLIC_REALTIME_URL;
    if (!socketUrl) {
      setStatus('fallback');
      const source = new EventSource(`/api/realtime?orgId=${encodeURIComponent(orgId)}&channel=${encodeURIComponent(channel)}`);

      source.onmessage = (message) => {
        try {
          const parsed = JSON.parse(message.data);
          if (parsed.event && parsed.event !== 'connected' && parsed.event !== 'timeout') {
            callbackRef.current(parsed.event, parsed as TPayload);
          }
        } catch {}
      };

      source.onerror = () => {
        source.close();
        setStatus('error');
      };

      return () => source.close();
    }

    setStatus('connecting');
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
      socket.emit('subscribe', { orgId, channel });
    });

    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('error'));

    for (const eventName of events) {
      socket.on(eventName, (payload: TPayload) => callbackRef.current(eventName, payload));
    }

    return () => {
      for (const eventName of events) {
        socket.off(eventName);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [orgId, channel, events]);

  return {
    status,
    socket: socketRef.current,
  };
}
