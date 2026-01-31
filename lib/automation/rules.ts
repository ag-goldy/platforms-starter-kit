/**
 * Automation rules engine
 * 
 * Evaluates and executes automation rules based on ticket events
 */

import { db } from '@/db';
import { automationRules, ticketTagAssignments, ticketTags } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { evaluateConditions } from './conditions';
import { executeActions } from './actions';
import type { Condition, Action, TriggerOn } from './types';
import type { Ticket } from '@/db/schema';

export interface RuleEvaluationContext {
  ticket: Ticket;
  triggerOn: TriggerOn;
  orgId: string;
  userId?: string;
}

/**
 * Get all enabled rules for an organization, ordered by priority
 */
export async function getEnabledRules(orgId: string, triggerOn: TriggerOn) {
  const rules = await db
    .select()
    .from(automationRules)
    .where(
      and(
        eq(automationRules.orgId, orgId),
        eq(automationRules.enabled, true),
        eq(automationRules.triggerOn, triggerOn)
      )
    )
    .orderBy(desc(automationRules.priority));

  return rules.map((rule) => ({
    ...rule,
    conditions: rule.conditions as unknown as Condition[],
    actions: rule.actions as unknown as Action[],
  }));
}

/**
 * Evaluate and execute rules for a ticket event
 */
export async function evaluateAndExecuteRules(
  context: RuleEvaluationContext
): Promise<{ matched: number; executed: number }> {
  const rules = await getEnabledRules(context.orgId, context.triggerOn);
  let matched = 0;
  let executed = 0;

  // Get ticket tags for condition evaluation
  const tagAssignments = await db
    .select({
      tagName: ticketTags.name,
    })
    .from(ticketTagAssignments)
    .innerJoin(ticketTags, eq(ticketTagAssignments.tagId, ticketTags.id))
    .where(eq(ticketTagAssignments.ticketId, context.ticket.id));
  const tagNames = tagAssignments.map((ta) => ta.tagName);

  for (const rule of rules) {
    // Evaluate conditions
    const matches = evaluateConditions(rule.conditions, {
      ticket: context.ticket,
      tags: tagNames,
    });

    if (matches) {
      matched++;
      try {
        // Execute actions
        await executeActions(rule.actions, {
          ticketId: context.ticket.id,
          orgId: context.orgId,
          userId: context.userId,
        });
        executed++;
      } catch (error) {
        console.error(`Failed to execute rule ${rule.id}:`, error);
        // Continue with other rules
      }
    }
  }

  return { matched, executed };
}

/**
 * Trigger rules evaluation on ticket create
 */
export async function triggerOnTicketCreate(ticket: Ticket, userId?: string): Promise<void> {
  await evaluateAndExecuteRules({
    ticket,
    triggerOn: 'TICKET_CREATED',
    orgId: ticket.orgId,
    userId,
  });
}

/**
 * Trigger rules evaluation on ticket update
 */
export async function triggerOnTicketUpdate(ticket: Ticket, userId?: string): Promise<void> {
  await evaluateAndExecuteRules({
    ticket,
    triggerOn: 'TICKET_UPDATED',
    orgId: ticket.orgId,
    userId,
  });
}

/**
 * Trigger rules evaluation on comment add
 */
export async function triggerOnCommentAdd(ticket: Ticket, userId?: string): Promise<void> {
  await evaluateAndExecuteRules({
    ticket,
    triggerOn: 'COMMENT_ADDED',
    orgId: ticket.orgId,
    userId,
  });
}
