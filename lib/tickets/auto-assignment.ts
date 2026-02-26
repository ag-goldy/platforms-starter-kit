'use server';

import { db } from '@/db';
import { tickets, ticketAssignmentRules, internalGroupMemberships, users } from '@/db/schema';
import { and, eq, inArray, desc, sql } from 'drizzle-orm';

/**
 * Evaluate assignment rules and auto-assign a ticket
 */
export async function evaluateAssignmentRules(
  orgId: string,
  ticketData: {
    id: string;
    requestTypeId?: string | null;
    category: 'INCIDENT' | 'SERVICE_REQUEST' | 'CHANGE_REQUEST';
    priority: 'P1' | 'P2' | 'P3' | 'P4';
    siteId?: string | null;
    subject: string;
    description: string;
  }
): Promise<{ assigned: boolean; assigneeId?: string; ruleId?: string; reason?: string }> {
  // Get active assignment rules for this org, ordered by priority
  const rules = await db.query.ticketAssignmentRules.findMany({
    where: and(
      eq(ticketAssignmentRules.orgId, orgId),
      eq(ticketAssignmentRules.isActive, true)
    ),
    orderBy: [desc(ticketAssignmentRules.priority)],
  });

  for (const rule of rules) {
    const conditions = rule.conditions as {
      requestTypeIds?: string[];
      category?: string[];
      priority?: string[];
      siteId?: string;
      keywords?: string[];
    };

    // Check if conditions match
    let matches = true;

    if (conditions.requestTypeIds?.length && ticketData.requestTypeId) {
      if (!conditions.requestTypeIds.includes(ticketData.requestTypeId)) {
        matches = false;
      }
    }

    if (conditions.category?.length) {
      if (!conditions.category.includes(ticketData.category)) {
        matches = false;
      }
    }

    if (conditions.priority?.length) {
      if (!conditions.priority.includes(ticketData.priority)) {
        matches = false;
      }
    }

    if (conditions.siteId && ticketData.siteId) {
      if (conditions.siteId !== ticketData.siteId) {
        matches = false;
      }
    }

    if (conditions.keywords?.length) {
      const text = `${ticketData.subject} ${ticketData.description}`.toLowerCase();
      const hasKeyword = conditions.keywords.some(kw => 
        text.includes(kw.toLowerCase())
      );
      if (!hasKeyword) {
        matches = false;
      }
    }

    if (!matches) continue;

    // Rule matches - apply assignment strategy
    let assigneeId: string | null = null;

    switch (rule.strategy) {
      case 'specific_user':
        assigneeId = rule.assigneeId;
        break;

      case 'round_robin': {
        // Get users in the group if specified, otherwise all internal users
        let userPool: string[] = [];

        if (rule.internalGroupId) {
          const memberships = await db.query.internalGroupMemberships.findMany({
            where: eq(internalGroupMemberships.groupId, rule.internalGroupId),
          });
          userPool = memberships.map(m => m.userId);
        } else {
          const internalUsers = await db.query.users.findMany({
            where: eq(users.isInternal, true),
            columns: { id: true },
          });
          userPool = internalUsers.map(u => u.id);
        }

        if (userPool.length === 0) break;

        // Find last assigned user index
        const lastIndex = rule.lastAssignedUserId
          ? userPool.indexOf(rule.lastAssignedUserId)
          : -1;

        // Get next user in rotation
        const nextIndex = (lastIndex + 1) % userPool.length;
        assigneeId = userPool[nextIndex];

        // Update the rule with last assigned user
        await db
          .update(ticketAssignmentRules)
          .set({ lastAssignedUserId: assigneeId })
          .where(eq(ticketAssignmentRules.id, rule.id));

        break;
      }

      case 'load_balance': {
        // Get users and their current open ticket counts
        let userIds: string[] = [];

        if (rule.internalGroupId) {
          const memberships = await db.query.internalGroupMemberships.findMany({
            where: eq(internalGroupMemberships.groupId, rule.internalGroupId),
          });
          userIds = memberships.map(m => m.userId);
        } else {
          const internalUsers = await db.query.users.findMany({
            where: eq(users.isInternal, true),
            columns: { id: true },
          });
          userIds = internalUsers.map(u => u.id);
        }

        if (userIds.length === 0) break;

        // Get open ticket counts for each user
        const ticketCounts = await db
          .select({
            assigneeId: tickets.assigneeId,
            count: sql<number>`count(*)::int`,
          })
          .from(tickets)
          .where(and(
            eq(tickets.orgId, orgId),
            inArray(tickets.assigneeId, userIds),
            sql`${tickets.status} NOT IN ('RESOLVED', 'CLOSED')`
          ))
          .groupBy(tickets.assigneeId);

        const countMap = new Map(ticketCounts.map(tc => [tc.assigneeId, tc.count]));

        // Find user with lowest count
        let minCount = Infinity;
        for (const userId of userIds) {
          const count = countMap.get(userId) || 0;
          if (count < minCount) {
            minCount = count;
            assigneeId = userId;
          }
        }

        break;
      }

      case 'group':
        // For group assignment, we could assign to the group lead or use round-robin within group
        // For now, just leave unassigned but tag with group
        break;
    }

    if (assigneeId) {
      // Update the ticket
      await db
        .update(tickets)
        .set({
          assigneeId,
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, ticketData.id));

      return {
        assigned: true,
        assigneeId,
        ruleId: rule.id,
        reason: `Matched rule: ${rule.name}`,
      };
    }
  }

  return { assigned: false, reason: 'No matching rules' };
}
