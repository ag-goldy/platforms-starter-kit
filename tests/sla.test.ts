import { describe, it, expect } from 'vitest';
import {
  getDefaultSLATargets,
  calculateSLAStatus,
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
});

