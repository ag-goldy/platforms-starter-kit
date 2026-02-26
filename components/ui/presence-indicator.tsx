'use client';

import { useTicketPresence } from '@/hooks/use-realtime';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Edit, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';

interface PresenceIndicatorProps {
  ticketId: string;
  className?: string;
}

export function PresenceIndicator({ ticketId, className }: PresenceIndicatorProps) {
  const { activeUsers } = useTicketPresence(ticketId);

  if (activeUsers.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex -space-x-2">
        <AnimatePresence>
          {activeUsers.slice(0, 3).map((user, idx) => (
            <motion.div
              key={user.userId}
              initial={{ opacity: 0, scale: 0.8, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: idx * 0.05 }}
              className="relative"
            >
              <Avatar className="w-7 h-7 border-2 border-white dark:border-gray-900">
                <AvatarImage src={user.userAvatar || undefined} />
                <AvatarFallback className="text-xs bg-orange-100 text-orange-700">
                  {user.userName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {user.isEditing && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center">
                  <Edit className="w-2 h-2 text-white" />
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {activeUsers.length > 3 && (
          <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-white dark:border-gray-900 flex items-center justify-center text-xs text-gray-600">
            +{activeUsers.length - 3}
          </div>
        )}
      </div>
      <span className="text-sm text-gray-500">
        {activeUsers.length === 1
          ? `${activeUsers[0].userName} is viewing`
          : `${activeUsers.length} people viewing`}
      </span>
    </div>
  );
}

interface LiveIndicatorProps {
  isLive?: boolean;
  className?: string;
}

export function LiveIndicator({ isLive = true, className }: LiveIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isLive && (
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
        </span>
      )}
      <span className={cn('text-xs font-medium', isLive ? 'text-green-600' : 'text-gray-500')}>
        {isLive ? 'Live' : 'Offline'}
      </span>
    </div>
  );
}

interface EditingIndicatorProps {
  userName: string;
  className?: string;
}

export function EditingIndicator({ userName, className }: EditingIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg',
        className
      )}
    >
      <Edit className="w-4 h-4 text-blue-600" />
      <span className="text-sm text-blue-800 dark:text-blue-200">
        <strong>{userName}</strong> is editing...
      </span>
    </motion.div>
  );
}

interface DraftSavedIndicatorProps {
  lastSaved: Date | null;
  isSaving: boolean;
  className?: string;
}

export function DraftSavedIndicator({ lastSaved, isSaving, className }: DraftSavedIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2 text-xs text-gray-500', className)}>
      {isSaving ? (
        <>
          <span className="animate-pulse">Saving...</span>
        </>
      ) : lastSaved ? (
        <>
          <span>Draft saved {formatTimeAgo(lastSaved)}</span>
        </>
      ) : null}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  return date.toLocaleDateString();
}

interface ActivityFeedProps {
  activities: Array<{
    id: string;
    user: {
      name: string;
      avatar?: string;
    };
    action: string;
    target?: string;
    timestamp: Date;
  }>;
  className?: string;
}

export function ActivityFeed({ activities, className }: ActivityFeedProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <AnimatePresence initial={false}>
        {activities.map((activity) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Avatar className="w-8 h-8">
              <AvatarImage src={activity.user.avatar} />
              <AvatarFallback>{activity.user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-gray-100">
                <span className="font-medium">{activity.user.name}</span>{' '}
                <span className="text-gray-600 dark:text-gray-400">{activity.action}</span>
                {activity.target && (
                  <span className="font-medium"> {activity.target}</span>
                )}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatTimeAgo(activity.timestamp)}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Online status badge
interface OnlineStatusProps {
  isOnline: boolean;
  lastSeen?: Date;
  className?: string;
}

export function OnlineStatus({ isOnline, lastSeen, className }: OnlineStatusProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(
          'w-2.5 h-2.5 rounded-full',
          isOnline ? 'bg-green-500' : 'bg-gray-400'
        )}
      />
      <span className="text-sm text-gray-600">
        {isOnline ? 'Online' : lastSeen ? `Last seen ${formatTimeAgo(lastSeen)}` : 'Offline'}
      </span>
    </div>
  );
}

// Typing indicator
interface TypingIndicatorProps {
  users: string[];
  className?: string;
}

export function TypingIndicator({ users, className }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className={cn('flex items-center gap-2 text-sm text-gray-500', className)}
    >
      <span className="flex gap-0.5">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </span>
      <span>
        {users.length === 1
          ? `${users[0]} is typing...`
          : `${users.length} people are typing...`}
      </span>
    </motion.div>
  );
}
