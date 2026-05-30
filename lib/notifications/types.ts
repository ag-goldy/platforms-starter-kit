export type NotificationType = 
  | 'TICKET_CREATED'
  | 'TICKET_UPDATED'
  | 'TICKET_ASSIGNED'
  | 'TICKET_COMMENTED'
  | 'TICKET_STATUS_CHANGED'
  | 'TICKET_PRIORITY_CHANGED'
  | 'TICKET_RESOLVED'
  | 'TICKET_REOPENED'
  | 'TICKET_MERGED'
  | 'TICKET_ESCALATED'
  | 'TICKET_SLA_BREACH'
  | 'TICKET_SLA_WARNING'
  | 'USER_MENTIONED'
  | 'ORG_INVITATION'
  | 'ORG_ROLE_CHANGED'
  | 'INTERNAL_GROUP_ASSIGNED'
  | 'AUTOMATION_TRIGGERED';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: {
    ticketId?: string;
    ticketKey?: string;
    commentId?: string;
    userId?: string;
    userName?: string;
    orgId?: string;
    orgName?: string;
    [key: string]: unknown;
  };
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  link?: string;
}

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
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
