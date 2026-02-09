import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NOTIFICATION_ICONS } from '@/lib/notifications/types';
import type { NotificationType } from '@/lib/notifications/types';

describe('Notifications System', () => {
  describe('NOTIFICATION_ICONS', () => {
    it('should have icons for all notification types', () => {
      const types: NotificationType[] = [
        'TICKET_CREATED',
        'TICKET_UPDATED',
        'TICKET_ASSIGNED',
        'TICKET_COMMENTED',
        'TICKET_STATUS_CHANGED',
        'TICKET_PRIORITY_CHANGED',
        'TICKET_RESOLVED',
        'TICKET_REOPENED',
        'TICKET_MERGED',
        'TICKET_ESCALATED',
        'TICKET_SLA_BREACH',
        'TICKET_SLA_WARNING',
        'USER_MENTIONED',
        'ORG_INVITATION',
        'ORG_ROLE_CHANGED',
        'INTERNAL_GROUP_ASSIGNED',
        'AUTOMATION_TRIGGERED',
      ];

      for (const type of types) {
        expect(NOTIFICATION_ICONS[type]).toBeDefined();
        expect(typeof NOTIFICATION_ICONS[type]).toBe('string');
      }
    });

    it('should have unique icons for different types', () => {
      const icons = Object.values(NOTIFICATION_ICONS);
      const uniqueIcons = new Set(icons);
      expect(uniqueIcons.size).toBe(icons.length);
    });

    it('should have specific icons for key types', () => {
      expect(NOTIFICATION_ICONS.TICKET_CREATED).toBe('🎫');
      expect(NOTIFICATION_ICONS.TICKET_RESOLVED).toBe('✅');
      expect(NOTIFICATION_ICONS.USER_MENTIONED).toBe('@️');
      expect(NOTIFICATION_ICONS.TICKET_SLA_BREACH).toBe('⏰');
    });
  });

  describe('Notification Type Safety', () => {
    it('should validate notification type values', () => {
      const validTypes: NotificationType[] = [
        'TICKET_CREATED',
        'USER_MENTIONED',
        'ORG_INVITATION',
      ];

      for (const type of validTypes) {
        expect(Object.keys(NOTIFICATION_ICONS)).toContain(type);
      }
    });
  });
});
