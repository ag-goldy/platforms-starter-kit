/**
 * Condition evaluation logic for automation rules
 */

import type { Condition } from './types';
import type { Ticket } from '@/db/schema';

export interface TicketContext {
  ticket: Pick<
    Ticket,
    | 'status'
    | 'priority'
    | 'category'
    | 'assigneeId'
    | 'subject'
    | 'description'
    | 'createdAt'
  >;
  tags?: string[];
}

/**
 * Evaluate a single condition against ticket context
 */
export function evaluateCondition(condition: Condition, context: TicketContext): boolean {
  const { type, value } = condition;
  const { ticket, tags = [] } = context;

  switch (type) {
    case 'status_equals':
      return ticket.status === value;

    case 'status_in':
      return Array.isArray(value) && value.includes(ticket.status);

    case 'priority_equals':
      return ticket.priority === value;

    case 'priority_in':
      return Array.isArray(value) && value.includes(ticket.priority);

    case 'category_equals':
      return ticket.category === value;

    case 'assignee_is':
      return ticket.assigneeId === value;

    case 'assignee_is_null':
      return ticket.assigneeId === null;

    case 'subject_contains':
      return typeof value === 'string' && ticket.subject.toLowerCase().includes(value.toLowerCase());

    case 'description_contains':
      return typeof value === 'string' && ticket.description.toLowerCase().includes(value.toLowerCase());

    case 'tag_equals':
      return typeof value === 'string' && tags.includes(value);

    case 'created_after':
      if (value instanceof Date) {
        return ticket.createdAt >= value;
      }
      return false;

    case 'created_before':
      if (value instanceof Date) {
        return ticket.createdAt <= value;
      }
      return false;

    default:
      return false;
  }
}

/**
 * Evaluate all conditions (AND logic - all must be true)
 */
export function evaluateConditions(
  conditions: Condition[],
  context: TicketContext
): boolean {
  if (conditions.length === 0) {
    return true; // No conditions = always match
  }

  return conditions.every((condition) => evaluateCondition(condition, context));
}

