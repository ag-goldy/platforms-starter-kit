'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

import { Badge } from '@/components/ui/badge';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

const NOTIFICATION_ICONS: Record<string, string> = {
  TICKET_CREATED: '🎫',
  TICKET_UPDATED: '📝',
  TICKET_ASSIGNED: '👤',
  TICKET_COMMENTED: '💬',
  TICKET_STATUS_CHANGED: '🔄',
  TICKET_PRIORITY_CHANGED: '⚡',
  TICKET_RESOLVED: '✅',
  TICKET_REOPENED: '🔓',
  TICKET_MERGED: '🔗',
  TICKET_ESCALATED: '📈',
  TICKET_SLA_BREACH: '⏰',
  TICKET_SLA_WARNING: '⚠️',
  USER_MENTIONED: '@️',
  ORG_INVITATION: '📧',
  ORG_ROLE_CHANGED: '🔑',
  INTERNAL_GROUP_ASSIGNED: '👥',
  AUTOMATION_TRIGGERED: '🤖',
};

// Reconnection backoff delays in milliseconds
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications?limit=10');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, []);

  // Connect to SSE stream
  const connectSSE = useCallback(() => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource('/api/notifications/stream');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        // Reset reconnection attempts on successful connection
        reconnectAttemptsRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle different message types
          switch (data.type) {
            case 'connected':
              // Connection established, refresh notifications
              fetchNotifications();
              break;

            case 'notification':
              // New notification received
              if (data.notification) {
                setNotifications((prev) => {
                  // Check if notification already exists
                  const exists = prev.some((n) => n.id === data.notification.id);
                  if (exists) {
                    return prev;
                  }
                  // Add new notification at the beginning
                  return [data.notification, ...prev].slice(0, 10);
                });
                setUnreadCount((prev) => prev + 1);
              }
              break;

            case 'timeout':
              // Server closed connection, reconnect
              eventSource.close();
              connectSSE();
              break;
          }
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        eventSource.close();
        eventSourceRef.current = null;

        // Attempt reconnection with exponential backoff
        const delay = RECONNECT_DELAYS[
          Math.min(reconnectAttemptsRef.current, RECONNECT_DELAYS.length - 1)
        ];
        reconnectAttemptsRef.current++;

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          connectSSE();
        }, delay);
      };
    } catch (error) {
      console.error('Failed to create SSE connection:', error);
    }
  }, [fetchNotifications]);

  // Disconnect from SSE stream
  const disconnectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchNotifications();

    // Connect to SSE for real-time updates
    connectSSE();

    // Cleanup on unmount
    return () => {
      disconnectSSE();
    };
  }, [fetchNotifications, connectSSE, disconnectSSE]);

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true }),
    });

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const formatTime = (date: string) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diff = now.getTime() - notificationDate.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return notificationDate.toLocaleDateString();
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="font-semibold">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No notifications
            </div>
          ) : (
            notifications.map((notification) => {
              const icon = NOTIFICATION_ICONS[notification.type] || '🔔';
              return (
                <div
                  key={notification.id}
                  className={`p-3 cursor-pointer hover:bg-accent ${
                    !notification.read ? 'bg-accent/50' : ''
                  }`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{notification.title}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
