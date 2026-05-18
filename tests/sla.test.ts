import { describe, it, expect } from 'vitest';
import {
  getDefaultSLATargets,
  calculateSLAStatus,
  calculateSLAClock,
} from '@/lib/tickets/sla';

describe('SLA Utilities', () => {
  describe('getDefaultSLATargets', () => {
    it('should return correct targets for P1 priority', () => {
      const targets = getDefaultSLATargets('P1');
      expect(targets.responseHours).toBe(1);
      expect(targets.resolutionHours).toBe(4);
    });

    it('should return correct targets for P2 priority', () => {
      const targets = getDefaultSLATargets('P2');
      expect(targets.responseHours).toBe(4);
      expect(targets.resolutionHours).toBe(24);
    });

    it('should return correct targets for P3 priority', () => {
      const targets = getDefaultSLATargets('P3');
      expect(targets.responseHours).toBe(24);
      expect(targets.resolutionHours).toBe(72);
    });

    it('should return correct targets for P4 priority', () => {
      const targets = getDefaultSLATargets('P4');
      expect(targets.responseHours).toBe(48);
      expect(targets.resolutionHours).toBe(168);
    });

    it('should return default targets for unknown priority', () => {
      const targets = getDefaultSLATargets('UNKNOWN');
      expect(targets.responseHours).toBe(24);
      expect(targets.resolutionHours).toBe(72);
    });
  });

  describe('calculateSLAStatus', () => {
    it('should return "met" when time is well below target', () => {
      const status = calculateSLAStatus(10, 100);
      expect(status).toBe('met');
    });

    it('should return "warning" when time is 80-99% of target', () => {
      const status1 = calculateSLAStatus(80, 100);
      expect(status1).toBe('warning');

      const status2 = calculateSLAStatus(99, 100);
      expect(status2).toBe('warning');
    });

    it('should return "breached" when time exceeds target', () => {
      const status1 = calculateSLAStatus(100, 100);
      expect(status1).toBe('breached');

      const status2 = calculateSLAStatus(150, 100);
      expect(status2).toBe('breached');
    });

    it('should return "not_applicable" when time is undefined', () => {
      const status = calculateSLAStatus(undefined, 100);
      expect(status).toBe('not_applicable');
    });

    it('should return "not_applicable" when target is undefined', () => {
      const status = calculateSLAStatus(50, undefined);
      expect(status).toBe('not_applicable');
    });

    it('should return "not_applicable" when both are undefined', () => {
      const status = calculateSLAStatus(undefined, undefined);
      expect(status).toBe('not_applicable');
    });
  });

  describe('calculateSLAClock', () => {
    const createdAt = new Date('2026-05-10T00:00:00.000Z');

    it('returns warning at the default 80 percent threshold', () => {
      const result = calculateSLAClock({
        createdAt,
        now: new Date('2026-05-10T08:00:00.000Z'),
        responseTargetHours: 10,
        resolutionTargetHours: 20,
      });

      expect(result.responseStatus).toBe('warning');
      expect(result.resolutionStatus).toBe('met');
      expect(result.responseDueAt?.toISOString()).toBe('2026-05-10T10:00:00.000Z');
    });

    it('returns breached after target time is reached', () => {
      const result = calculateSLAClock({
        createdAt,
        now: new Date('2026-05-10T11:00:00.000Z'),
        responseTargetHours: 10,
        resolutionTargetHours: 10,
      });

      expect(result.responseStatus).toBe('breached');
      expect(result.resolutionStatus).toBe('breached');
    });

    it('marks responded and resolved clocks as met', () => {
      const result = calculateSLAClock({
        createdAt,
        now: new Date('2026-05-11T00:00:00.000Z'),
        firstResponseAt: new Date('2026-05-10T01:00:00.000Z'),
        resolvedAt: new Date('2026-05-10T05:00:00.000Z'),
        responseTargetHours: 2,
        resolutionTargetHours: 8,
      });

      expect(result.responseStatus).toBe('met');
      expect(result.resolutionStatus).toBe('met');
    });

    it('pauses open clocks when ticket is waiting on customer', () => {
      const result = calculateSLAClock({
        createdAt,
        now: new Date('2026-05-11T00:00:00.000Z'),
        status: 'WAITING_ON_CUSTOMER',
        responseTargetHours: 2,
        resolutionTargetHours: 8,
      });

      expect(result.responseStatus).toBe('paused');
      expect(result.resolutionStatus).toBe('paused');
    });
  });
});
