/**
 * Default/built-in automation rules
 * 
 * These can be automatically created for new organizations
 */

import type { Condition, Action, TriggerOn } from './types';

export interface DefaultRule {
  name: string;
  enabled: boolean;
  priority: number;
  triggerOn: TriggerOn;
  conditions: Condition[];
  actions: Action[];
}

export const DEFAULT_RULES: DefaultRule[] = [
  // Category-based priority: High priority for INCIDENT category
  {
    name: 'High Priority for Incidents',
    enabled: true,
    priority: 100,
    triggerOn: 'TICKET_CREATED',
    conditions: [
      { type: 'category_equals', value: 'INCIDENT' },
    ],
    actions: [
      { type: 'set_priority', value: 'P1' },
    ],
  },
  // Keyword-based routing: Invoice/billing keywords → Finance tag
  {
    name: 'Tag Finance-related Tickets',
    enabled: true,
    priority: 50,
    triggerOn: 'TICKET_CREATED',
    conditions: [
      {
        type: 'subject_contains',
        value: 'invoice',
      },
    ],
    actions: [
      { type: 'add_tag', value: 'finance' },
    ],
  },
  {
    name: 'Tag Finance-related Tickets (Description)',
    enabled: true,
    priority: 50,
    triggerOn: 'TICKET_CREATED',
    conditions: [
      {
        type: 'description_contains',
        value: 'invoice',
      },
    ],
    actions: [
      { type: 'add_tag', value: 'finance' },
    ],
  },
  // Round-robin assignment for unassigned tickets
  {
    name: 'Auto-assign Unassigned Tickets',
    enabled: true,
    priority: 10,
    triggerOn: 'TICKET_CREATED',
    conditions: [
      { type: 'assignee_is_null', value: null },
    ],
    actions: [
      { type: 'assign_to_round_robin', value: null },
    ],
  },
];

/**
 * Create default rules for an organization
 */
export async function createDefaultRules(orgId: string): Promise<void> {
  for (const rule of DEFAULT_RULES) {
    try {
      const { createAutomationRuleAction } = await import('@/app/app/actions/automation');
      await createAutomationRuleAction(orgId, rule);
    } catch (error) {
      console.error(`Failed to create default rule "${rule.name}":`, error);
      // Continue with other rules even if one fails
    }
  }
}
