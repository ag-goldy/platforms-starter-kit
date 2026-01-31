/**
 * Action execution logic for automation rules
 */

import { db } from '@/db';
import { tickets, ticketTagAssignments, ticketTags, users, ticketCategoryEnum } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import type { Action } from './types';
import type { TicketPriority, TicketStatus } from '@/lib/tickets/queries';

type TicketCategory = (typeof ticketCategoryEnum.enumValues)[number];

export interface ActionContext {
  ticketId: string;
  orgId: string;
  userId?: string;
}

/**
 * Execute a single action
 */
export async function executeAction(
  action: Action,
  context: ActionContext
): Promise<void> {
  const { type, value } = action;
  const { ticketId, orgId } = context;

  switch (type) {
    case 'set_status':
      if (typeof value === 'string') {
        await db
          .update(tickets)
          .set({ status: value as TicketStatus, updatedAt: new Date() })
          .where(eq(tickets.id, ticketId));
      }
      break;

    case 'set_priority':
      if (typeof value === 'string') {
        await db
          .update(tickets)
          .set({ priority: value as TicketPriority, updatedAt: new Date() })
          .where(eq(tickets.id, ticketId));
      }
      break;

    case 'set_category':
      if (typeof value === 'string') {
        await db
          .update(tickets)
          .set({ category: value as TicketCategory, updatedAt: new Date() })
          .where(eq(tickets.id, ticketId));
      }
      break;

    case 'assign_to':
      if (typeof value === 'string') {
        await db
          .update(tickets)
          .set({ assigneeId: value, updatedAt: new Date() })
          .where(eq(tickets.id, ticketId));
      }
      break;

    case 'assign_to_round_robin':
      await assignRoundRobin(ticketId, orgId);
      break;

    case 'add_tag':
      if (typeof value === 'string') {
        await addTag(ticketId, value);
      }
      break;

    case 'remove_tag':
      if (typeof value === 'string') {
        await removeTag(ticketId, value);
      }
      break;

    case 'notify_assignee':
    case 'notify_team':
      // TODO: Implement notifications
      break;

    default:
      console.warn(`Unknown action type: ${type}`);
  }
}

/**
 * Execute all actions
 */
export async function executeActions(
  actions: Action[],
  context: ActionContext
): Promise<void> {
  for (const action of actions) {
    try {
      await executeAction(action, context);
    } catch (error) {
      console.error(`Failed to execute action ${action.type}:`, error);
      // Continue with other actions even if one fails
    }
  }
}

/**
 * Assign ticket using round-robin algorithm
 */
async function assignRoundRobin(ticketId: string, orgId: string): Promise<void> {
  // Get all internal users
  const allUsers = await db.query.users.findMany({
    where: eq(users.isInternal, true),
  });

  if (allUsers.length === 0) {
    return; // No users to assign to
  }

  // Simple round-robin: Get ticket count per user and assign to user with least tickets
  // This is a simplified version - in production, you'd want more sophisticated logic
  const ticketCounts = await Promise.all(
    allUsers.map(async (user) => {
      const count = await db.query.tickets.findMany({
        where: and(eq(tickets.orgId, orgId), eq(tickets.assigneeId, user.id)),
      });
      return { userId: user.id, count: count.length };
    })
  );

  // Find user with least tickets
  const userWithLeastTickets = ticketCounts.reduce((min, current) =>
    current.count < min.count ? current : min
  );

  await db
    .update(tickets)
    .set({ assigneeId: userWithLeastTickets.userId, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));
}

/**
 * Add a tag to a ticket
 */
async function addTag(ticketId: string, tagName: string): Promise<void> {
  // Find or create tag
  const existingTags = await db
    .select()
    .from(ticketTags)
    .where(eq(ticketTags.name, tagName))
    .limit(1);

  let tag = existingTags[0];

  if (!tag) {
    const [newTag] = await db.insert(ticketTags).values({ name: tagName }).returning();
    tag = newTag;
  }

  // Check if assignment already exists
  const existingAssignments = await db
    .select()
    .from(ticketTagAssignments)
    .where(
      and(
        eq(ticketTagAssignments.ticketId, ticketId),
        eq(ticketTagAssignments.tagId, tag.id)
      )
    )
    .limit(1);

  if (existingAssignments.length === 0) {
    await db.insert(ticketTagAssignments).values({
      ticketId,
      tagId: tag.id,
    });
  }
}

/**
 * Remove a tag from a ticket
 */
async function removeTag(ticketId: string, tagName: string): Promise<void> {
  const tags = await db
    .select()
    .from(ticketTags)
    .where(eq(ticketTags.name, tagName))
    .limit(1);

  const tag = tags[0];

  if (tag) {
    await db
      .delete(ticketTagAssignments)
      .where(
        and(
          eq(ticketTagAssignments.ticketId, ticketId),
          eq(ticketTagAssignments.tagId, tag.id)
        )
      );
  }
}
