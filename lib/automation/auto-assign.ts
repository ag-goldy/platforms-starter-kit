/**
 * Auto-Assignment Rules
 *
 * Automatically assigns tickets to agents based on:
 * 1. Workload-based: Assign to agent with fewest open tickets
 * 2. Round-robin: Rotate among agents with equal workload
 * 3. Fallback: If no rules match, leave unassigned
 */

import { db } from "@/db";
import { eq, and, sql, count } from "drizzle-orm";
import { memberships, tickets } from "@/db/schema";

export interface AssignmentResult {
  assigneeId: string | null;
  reason: string;
  method: "workload" | "round-robin" | "fallback" | "none";
  confidence: number;
}

// Get available agents for an org (users with ADMIN or AGENT role)
async function getAvailableAgents(
  orgId: string,
): Promise<{ id: string; role: string }[]> {
  const members = await db
    .select({
      userId: memberships.userId,
      role: memberships.role,
    })
    .from(memberships)
    .where(
      and(
        eq(memberships.orgId, orgId),
        sql`${memberships.role} IN ('ADMIN', 'AGENT')`,
      ),
    );
  return members.map((m) => ({ id: m.userId, role: m.role }));
}

// Count open tickets per agent
async function getAgentWorkloads(
  orgId: string,
  agentIds: string[],
): Promise<Map<string, number>> {
  if (agentIds.length === 0) return new Map();

  const workloads = await db
    .select({
      assigneeId: tickets.assigneeId,
      openCount: count(),
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.orgId, orgId),
        sql`${tickets.assigneeId} IN (${sql.join(
          agentIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
        sql`${tickets.status} NOT IN ('RESOLVED', 'CLOSED')`,
      ),
    )
    .groupBy(tickets.assigneeId);

  const map = new Map<string, number>();
  agentIds.forEach((id) => map.set(id, 0)); // initialize all to 0
  workloads.forEach((w) => {
    if (w.assigneeId) map.set(w.assigneeId, Number(w.openCount));
  });
  return map;
}

// Get the last assigned agent for round-robin
async function getLastAssignedAgent(orgId: string): Promise<string | null> {
  const lastTicket = await db
    .select({ assigneeId: tickets.assigneeId })
    .from(tickets)
    .where(
      and(eq(tickets.orgId, orgId), sql`${tickets.assigneeId} IS NOT NULL`),
    )
    .orderBy(sql`${tickets.createdAt} DESC`)
    .limit(1);

  return lastTicket[0]?.assigneeId || null;
}

/**
 * Auto-assign a ticket to an available agent
 */
export async function autoAssignTicket(
  orgId: string,
  _category?: string | null,
  _priority?: string | null,
  _subject?: string | null,
  _description?: string | null,
): Promise<AssignmentResult> {
  const agents = await getAvailableAgents(orgId);

  if (agents.length === 0) {
    return {
      assigneeId: null,
      reason: "No available agents",
      method: "none",
      confidence: 0,
    };
  }

  if (agents.length === 1) {
    return {
      assigneeId: agents[0].id,
      reason: "Only available agent",
      method: "fallback",
      confidence: 100,
    };
  }

  // Strategy 1: Workload-based (assign to agent with fewest open tickets)
  const agentIds = agents.map((a) => a.id);
  const workloads = await getAgentWorkloads(orgId, agentIds);

  let minWorkload = Infinity;
  let leastBusyAgent: string | null = null;

  for (const [agentId, openCount] of workloads) {
    if (openCount < minWorkload) {
      minWorkload = openCount;
      leastBusyAgent = agentId;
    }
  }

  // Strategy 2: Round-robin (if workloads are equal, rotate)
  const allEqual = [...workloads.values()].every((v) => v === minWorkload);

  if (allEqual) {
    const lastAssigned = await getLastAssignedAgent(orgId);
    const lastIndex = lastAssigned ? agentIds.indexOf(lastAssigned) : -1;
    const nextIndex = (lastIndex + 1) % agentIds.length;

    return {
      assigneeId: agentIds[nextIndex],
      reason: "Round-robin assignment (equal workloads)",
      method: "round-robin",
      confidence: 80,
    };
  }

  return {
    assigneeId: leastBusyAgent,
    reason: `Lowest workload (${minWorkload} open tickets)`,
    method: "workload",
    confidence: 85,
  };
}
