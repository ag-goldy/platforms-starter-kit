'use client';

import { formatDateTime } from '@/lib/utils/date';
import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  User,
  AlertCircle,
  FileText,
  Merge,
  Trash2,
  Edit,
  Plus,
  ArrowRight,
} from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: 'comment' | 'status_change' | 'assignment' | 'attachment' | 'merge' | 'field_change' | 'create' | 'delete';
  timestamp: Date | string;
  actor: {
    id: string;
    name: string;
    avatar?: string;
  };
  content: string;
  metadata?: Record<string, unknown>;
  isInternal?: boolean;
}

interface ActivityTimelineProps {
  events: TimelineEvent[];
  className?: string;
  showFilter?: boolean;
}

const eventIcons = {
  comment: <MessageSquare className="h-4 w-4" />,
  status_change: <AlertCircle className="h-4 w-4" />,
  assignment: <User className="h-4 w-4" />,
  attachment: <FileText className="h-4 w-4" />,
  merge: <Merge className="h-4 w-4" />,
  field_change: <Edit className="h-4 w-4" />,
  create: <Plus className="h-4 w-4" />,
  delete: <Trash2 className="h-4 w-4" />,
};

const eventColors = {
  comment: 'bg-orange-100 text-orange-600',
  status_change: 'bg-gray-100 text-gray-600',
  assignment: 'bg-black text-white',
  attachment: 'bg-gray-50 text-gray-600',
  merge: 'bg-orange-50 text-orange-600',
  field_change: 'bg-gray-100 text-gray-600',
  create: 'bg-black text-white',
  delete: 'bg-red-100 text-red-600',
};

function formatEventContent(event: TimelineEvent): string {
  switch (event.type) {
    case 'status_change':
      const from = event.metadata?.from as string;
      const to = event.metadata?.to as string;
      return `changed status from "${from}" to "${to}"`;
    
    case 'assignment':
      const assignee = event.metadata?.assigneeName as string;
      return assignee ? `assigned to ${assignee}` : 'unassigned';
    
    case 'field_change':
      const field = event.metadata?.field as string;
      return `updated ${field}`;
    
    case 'attachment':
      const filename = event.metadata?.filename as string;
      return filename ? `attached "${filename}"` : 'added attachment';
    
    case 'merge':
      const ticketKey = event.metadata?.ticketKey as string;
      return ticketKey ? `merged ticket ${ticketKey}` : 'merged ticket';
    
    case 'create':
      return 'created this ticket';
    
    case 'delete':
      return 'deleted this ticket';
    
    default:
      return event.content;
  }
}

export function ActivityTimeline({ events, className, showFilter = false }: ActivityTimelineProps) {
  // Group events by date
  const groupedEvents = events.reduce((groups, event) => {
    const date = new Date(event.timestamp);
    const dateKey = date.toISOString().split('T')[0];
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(event);
    return groups;
  }, {} as Record<string, TimelineEvent[]>);

  const sortedDates = Object.keys(groupedEvents).sort((a, b) => {
    const dateA = new Date(a).getTime();
    const dateB = new Date(b).getTime();
    return dateB - dateA;
  });

  const getRelativeDate = (dateKey: string) => {
    const date = new Date(dateKey);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateStr = date.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (dateStr === todayStr) return 'Today';
    if (dateStr === yesterdayStr) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className={cn("space-y-6", className)}>
      {showFilter && (
        <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">Show:</span>
          <button className="text-sm font-bold text-gray-900 bg-gray-100 px-3 py-1.5 rounded-lg">
            All
          </button>
          <button className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            Comments
          </button>
          <button className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            History
          </button>
        </div>
      )}

      {sortedDates.map((dateKey) => (
        <div key={dateKey} className="space-y-4">
          <h4 className="text-sm font-bold text-gray-900 sticky top-0 bg-white/95 backdrop-blur py-2 px-1">
            {getRelativeDate(dateKey)}
          </h4>
          
          <div className="space-y-4">
            {groupedEvents[dateKey].map((event) => (
              <div key={event.id} className="flex gap-3 group">
                {/* Icon */}
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-white/20",
                    eventColors[event.type]
                  )}>
                    {eventIcons[event.type]}
                  </div>
                  <div className="w-px h-full bg-gray-100 my-1 group-last:hidden" />
                </div>

                {/* Content */}
                <div className="flex-1 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {event.actor.avatar ? (
                        <img 
                          src={event.actor.avatar} 
                          alt={event.actor.name}
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                          {event.actor.name.charAt(0)}
                        </div>
                      )}
                      <span className="font-bold text-sm text-gray-900">{event.actor.name}</span>
                      <span className="text-sm text-gray-500 font-medium">
                        {formatEventContent(event)}
                      </span>
                    </div>
                    <time 
                      className="text-xs text-gray-400 shrink-0 font-medium"
                      title={formatDateTime(event.timestamp)}
                    >
                      {formatDateTime(event.timestamp)}
                    </time>
                  </div>

                  {event.type === 'comment' && !!event.content && (
                    <div className={cn("mt-3 p-4 rounded-xl text-sm border", event.isInternal ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-gray-200")}>
                      {event.isInternal && <span className="text-xs font-bold text-orange-700 mb-1 block">Internal Note</span>}
                      <p className="whitespace-pre-wrap text-gray-800 leading-relaxed">{event.content}</p>
                    </div>
                  )}

                  {event.type === 'status_change' 
                    && typeof event.metadata?.from === 'string' 
                    && typeof event.metadata?.to === 'string' && (
                    <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">Status:</span>
                        <span className="text-xs font-bold text-gray-700 px-2 py-1 bg-white rounded-md border">
                          {String(event.metadata.from)}
                        </span>
                        <ArrowRight className="w-3 h-3 text-gray-400" />
                        <span className="text-xs font-bold text-orange-700 px-2 py-1 bg-orange-50 rounded-md border border-orange-200">
                          {String(event.metadata.to)}
                        </span>
                      </div>
                    </div>
                  )}

                  {event.type === 'assignment' 
                    && typeof event.metadata?.assigneeName === 'string' && (
                    <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">Assigned to:</span>
                        <span className="text-xs font-bold text-gray-700">{String(event.metadata.assigneeName)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
