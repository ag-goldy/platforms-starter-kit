import { describe, expect, it } from 'vitest';
import { evaluateConditions } from '@/lib/automation/conditions';

const ticket = {
  status: 'NEW',
  priority: 'P1',
  category: 'INCIDENT',
  assigneeId: null,
  subject: 'Core switch offline',
  description: 'Main office cannot reach the network.',
  createdAt: new Date('2026-05-10T00:00:00Z'),
};

describe('automation condition evaluation', () => {
  it('matches a P1 unassigned incident rule', () => {
    expect(evaluateConditions([
      { type: 'priority_equals', value: 'P1' },
      { type: 'assignee_is_null', value: null },
      { type: 'category_equals', value: 'INCIDENT' },
    ], { ticket })).toBe(true);
  });

  it('requires every condition to match', () => {
    expect(evaluateConditions([
      { type: 'priority_equals', value: 'P1' },
      { type: 'status_equals', value: 'RESOLVED' },
    ], { ticket })).toBe(false);
  });
});
