import { db } from '@/db';
import { tickets, memberships, users } from '@/db/schema';
import { eq, and, count, inArray, gt } from 'drizzle-orm';

export interface AgentScore {
  userId: string;
  name: string | null;
  email: string;
  score: number;
  reasons: string[];
  workload: {
    openTickets: number;
    highPriority: number;
  };
}

export interface AssignmentRecommendation {
  recommendedAgentId: string | null;
  recommendedAgentName: string | null;
  confidence: number;
  alternatives: AgentScore[];
  reason: string;
}

// Category to skill mapping
const CATEGORY_SKILLS: Record<string, string[]> = {
  INCIDENT: ['incident_management', 'troubleshooting', 'technical'],
  SERVICE_REQUEST: ['customer_service', 'provisioning', 'access_management'],
  CHANGE_REQUEST: ['change_management', 'planning', 'coordination'],
};

// Priority weights for workload calculation
const PRIORITY_WEIGHTS = {
  P1: 5,
  P2: 3,
  P3: 2,
  P4: 1,
};

/**
 * Calculate agent workload score
 */
async function calculateAgentWorkload(userId: string): Promise<{
  openTickets: number;
  highPriority: number;
  weightedLoad: number;
}> {
  const result = await db
    .select({
      priority: tickets.priority,
      count: count(),
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.assigneeId, userId),
        inArray(tickets.status, ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER'])
      )
    )
    .groupBy(tickets.priority);

  let openTickets = 0;
  let highPriority = 0;
  let weightedLoad = 0;

  for (const row of result) {
    openTickets += row.count;
    weightedLoad += row.count * (PRIORITY_WEIGHTS[row.priority as keyof typeof PRIORITY_WEIGHTS] || 1);
    
    if (row.priority === 'P1' || row.priority === 'P2') {
      highPriority += row.count;
    }
  }

  return { openTickets, highPriority, weightedLoad };
}

/**
 * Find best agent for a ticket
 */
export async function findBestAgent(
  orgId: string,
  options: {
    category?: string;
    priority?: string;
    requestTypeId?: string;
    excludeUserIds?: string[];
  }
): Promise<AssignmentRecommendation> {
  const { category, priority, excludeUserIds = [] } = options;

  // Get all active internal users in the org
  let agents = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .innerJoin(memberships, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.orgId, orgId),
        eq(memberships.isActive, true),
        eq(users.isInternal, true)
      )
    );

  // Filter out excluded users
  if (excludeUserIds.length > 0) {
    agents = agents.filter(agent => !excludeUserIds.includes(agent.userId));
  }

  if (agents.length === 0) {
    return {
      recommendedAgentId: null,
      recommendedAgentName: null,
      confidence: 0,
      alternatives: [],
      reason: 'No available agents found',
    };
  }

  // Score each agent
  const scoredAgents: AgentScore[] = [];

  for (const agent of agents) {
    const score: AgentScore = {
      userId: agent.userId,
      name: agent.name,
      email: agent.email,
      score: 0,
      reasons: [],
      workload: { openTickets: 0, highPriority: 0 },
    };

    // Calculate workload
    const workload = await calculateAgentWorkload(agent.userId);
    score.workload = workload;

    // Workload penalty (lower is better)
    const maxLoad = 20; // Consider max reasonable load
    const loadRatio = Math.min(workload.weightedLoad / maxLoad, 1);
    const workloadScore = (1 - loadRatio) * 40; // 40% weight
    score.score += workloadScore;

    if (workload.openTickets === 0) {
      score.reasons.push('No current workload');
      score.score += 10; // Bonus for empty queue
    } else if (workload.openTickets < 5) {
      score.reasons.push('Light workload');
    }

    // High priority handling
    if (priority === 'P1' || priority === 'P2') {
      if (workload.highPriority === 0) {
        score.score += 15;
        score.reasons.push('No high-priority tickets');
      }
    }

    // Category skill matching (would integrate with actual skills system)
    if (category && CATEGORY_SKILLS[category]) {
      // Placeholder for skill matching - in production would check user skills
      score.score += 10;
      score.reasons.push(`Category match: ${category}`);
    }

    // Round-robin consideration - boost agents who haven't been assigned recently
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAssignments = await db
      .select({ count: count() })
      .from(tickets)
      .where(
        and(
          eq(tickets.assigneeId, agent.userId),
          gt(tickets.createdAt, oneDayAgo)
        )
      );

    const recentCount = recentAssignments[0]?.count || 0;
    if (recentCount === 0) {
      score.score += 10;
      score.reasons.push('No recent assignments (24h)');
    } else if (recentCount < 3) {
      score.score += 5;
    }

    scoredAgents.push(score);
  }

  // Sort by score (highest first)
  scoredAgents.sort((a, b) => b.score - a.score);

  const best = scoredAgents[0];
  const confidence = Math.min(best.score / 100, 0.95);

  return {
    recommendedAgentId: best.userId,
    recommendedAgentName: best.name || best.email,
    confidence,
    alternatives: scoredAgents.slice(1, 4), // Top 3 alternatives
    reason: best.reasons.join('; ') || 'Best available agent',
  };
}

/**
 * Auto-assign a ticket to the best agent
 */
export async function autoAssignTicket(
  ticketId: string,
  confidenceThreshold: number = 0.6
): Promise<{
  assigned: boolean;
  agentId?: string;
  agentName?: string;
  confidence?: number;
  reason?: string;
}> {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: {
      id: true,
      orgId: true,
      category: true,
      priority: true,
      requestTypeId: true,
      assigneeId: true,
    },
  });

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  // Don't reassign if already assigned
  if (ticket.assigneeId) {
    return { assigned: false, reason: 'Ticket already assigned' };
  }

  const recommendation = await findBestAgent(ticket.orgId, {
    category: ticket.category || undefined,
    priority: ticket.priority,
    requestTypeId: ticket.requestTypeId || undefined,
  });

  if (!recommendation.recommendedAgentId) {
    return { assigned: false, reason: 'No suitable agent found' };
  }

  if (recommendation.confidence >= confidenceThreshold) {
    await db
      .update(tickets)
      .set({
        assigneeId: recommendation.recommendedAgentId,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticketId));

    return {
      assigned: true,
      agentId: recommendation.recommendedAgentId,
      agentName: recommendation.recommendedAgentName || undefined,
      confidence: recommendation.confidence,
      reason: recommendation.reason,
    };
  }

  return {
    assigned: false,
    agentId: recommendation.recommendedAgentId,
    agentName: recommendation.recommendedAgentName || undefined,
    confidence: recommendation.confidence,
    reason: 'Confidence below threshold',
  };
}

/**
 * Get workload distribution for an org
 */
export async function getWorkloadDistribution(orgId: string): Promise<{
  userId: string;
  name: string | null;
  openTickets: number;
  p1Tickets: number;
  p2Tickets: number;
  p3Tickets: number;
  p4Tickets: number;
}[]> {
  const agents = await db
    .select({
      userId: users.id,
      name: users.name,
    })
    .from(users)
    .innerJoin(memberships, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.orgId, orgId),
        eq(memberships.isActive, true),
        eq(users.isInternal, true)
      )
    );

  const distribution = [];

  for (const agent of agents) {
    const byPriority = await db
      .select({
        priority: tickets.priority,
        count: count(),
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.assigneeId, agent.userId),
          inArray(tickets.status, ['NEW', 'OPEN', 'IN_PROGRESS'])
        )
      )
      .groupBy(tickets.priority);

    const counts = {
      P1: 0, P2: 0, P3: 0, P4: 0,
    };
    let total = 0;

    for (const row of byPriority) {
      counts[row.priority as keyof typeof counts] = row.count;
      total += row.count;
    }

    distribution.push({
      userId: agent.userId,
      name: agent.name,
      openTickets: total,
      p1Tickets: counts.P1,
      p2Tickets: counts.P2,
      p3Tickets: counts.P3,
      p4Tickets: counts.P4,
    });
  }

  return distribution;
}
