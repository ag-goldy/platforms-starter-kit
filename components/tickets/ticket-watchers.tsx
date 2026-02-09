'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

interface Watcher {
  id: string;
  name: string | null;
  email: string;
  createdAt: Date;
}

interface TicketWatchersProps {
  ticketId: string;
}

export function TicketWatchers({ ticketId }: TicketWatchersProps) {
  const { showToast } = useToast();
  const [watchers, setWatchers] = useState<Watcher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [currentUserWatching, setCurrentUserWatching] = useState(false);

  useEffect(() => {
    fetchWatchers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  async function fetchWatchers() {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/watchers`);
      if (!response.ok) {
        throw new Error('Failed to fetch watchers');
      }
      const data = await response.json();
      setWatchers(data.watchers || []);
      
      // Check if current user is in the watchers list
      // Note: We don't have current user ID here, but the API will handle the toggle
      // We'll update this state after the toggle response
    } catch (error) {
      console.error('Failed to load watchers:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleWatch() {
    setIsToggling(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/watchers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to toggle watcher status');
      }

      const data = await response.json();
      setCurrentUserWatching(data.watching);
      
      // Refresh watchers list
      await fetchWatchers();
      
      showToast(
        data.watching ? 'You are now watching this ticket' : 'You are no longer watching this ticket',
        'success'
      );
    } catch (error) {
      console.error('Failed to toggle watcher:', error);
      showToast('Failed to update watcher status', 'error');
    } finally {
      setIsToggling(false);
    }
  }

  // Get initials for avatar fallback
  function getInitials(name: string | null, email: string): string {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  }

  // Get display name
  function getDisplayName(watcher: Watcher): string {
    return watcher.name || watcher.email;
  }

  // Generate a consistent color based on user ID
  function getAvatarColor(userId: string): string {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading watchers...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Watchers avatars */}
      <div className="flex items-center">
        {watchers.length === 0 ? (
          <span className="text-sm text-gray-500">No watchers</span>
        ) : (
          <div className="flex -space-x-2">
            {watchers.slice(0, 5).map((watcher) => (
              <div
                key={watcher.id}
                className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full ${getAvatarColor(
                  watcher.id
                )} text-xs font-medium text-white ring-2 ring-white`}
                title={getDisplayName(watcher)}
              >
                {getInitials(watcher.name, watcher.email)}
              </div>
            ))}
            {watchers.length > 5 && (
              <div className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 text-xs font-medium text-gray-700 ring-2 ring-white">
                +{watchers.length - 5}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Watch count */}
      {watchers.length > 0 && (
        <span className="text-sm text-gray-600">
          {watchers.length} {watchers.length === 1 ? 'watcher' : 'watchers'}
        </span>
      )}

      {/* Toggle button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggleWatch}
        disabled={isToggling}
        className="ml-2"
      >
        {isToggling ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : currentUserWatching ? (
          <EyeOff className="mr-1 h-4 w-4" />
        ) : (
          <Eye className="mr-1 h-4 w-4" />
        )}
        {isToggling
          ? 'Updating...'
          : currentUserWatching
          ? 'Unwatch'
          : 'Watch'}
      </Button>
    </div>
  );
}
