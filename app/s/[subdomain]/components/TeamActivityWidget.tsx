'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, Ticket, MessageSquare, Clock, ChevronRight } from 'lucide-react';
import { useCustomerPortal } from '@/components/customer/CustomerPortalContext';

interface TeamActivityWidgetProps {
  subdomain: string;
  org: any;
}

interface Activity {
  id: string;
  type: 'user_joined' | 'ticket_created' | 'ticket_resolved' | 'comment_added';
  user: {
    name: string;
    avatar?: string;
  };
  details: string;
  timestamp: string;
}

interface OnlineMember {
  id: string;
  name: string;
  avatar?: string;
  isOnline: boolean;
}

export function TeamActivityWidget({ subdomain, org }: TeamActivityWidgetProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { openSlideOver } = useCustomerPortal();

  useEffect(() => {
    fetchActivityData();
    const interval = setInterval(fetchActivityData, 30000);
    return () => clearInterval(interval);
  }, [org.id]);

  const fetchActivityData = async () => {
    try {
      const res = await fetch(`/api/team/${subdomain}/activity`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
        setOnlineMembers(data.onlineMembers || []);
      }
    } catch (error) {
      console.error('Failed to fetch activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'user_joined':
        return <UserPlus className="w-3.5 h-3.5 text-emerald-500" />;
      case 'ticket_created':
        return <Ticket className="w-3.5 h-3.5 text-blue-500" />;
      case 'ticket_resolved':
        return <Ticket className="w-3.5 h-3.5 text-emerald-500" />;
      case 'comment_added':
        return <MessageSquare className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-stone-400" />;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-500" />
          <h3 className="font-semibold text-stone-900">Team Activity</h3>
        </div>
        <button
          onClick={() => openSlideOver('team')}
          className="text-xs text-brand-600 hover:text-brand-700 font-medium"
        >
          View all
        </button>
      </div>

      {/* Online Members */}
      {onlineMembers.length > 0 && (
        <div className="px-4 py-3 border-b border-stone-100">
          <p className="text-xs text-stone-500 mb-2">
            {onlineMembers.length} online
          </p>
          <div className="flex -space-x-2">
            {onlineMembers.slice(0, 5).map((member) => (
              <div
                key={member.id}
                className="relative w-8 h-8 rounded-full bg-stone-100 border-2 border-white flex items-center justify-center"
                title={member.name}
              >
                {member.avatar ? (
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-semibold text-stone-600">
                    {member.name[0]}
                  </span>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
              </div>
            ))}
            {onlineMembers.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-stone-100 border-2 border-white flex items-center justify-center text-xs font-medium text-stone-600">
                +{onlineMembers.length - 5}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activity Feed */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Clock className="w-8 h-8 text-stone-300 mb-2" />
            <p className="text-xs text-stone-500">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-3"
              >
                <div className="w-7 h-7 rounded-full bg-stone-50 flex items-center justify-center flex-shrink-0">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-700">
                    <span className="font-medium text-stone-900">{activity.user.name}</span>{' '}
                    {activity.details}
                  </p>
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    {formatTimeAgo(activity.timestamp)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
