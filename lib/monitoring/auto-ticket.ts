/**
 * Zabbix Auto-Ticket Creation
 * 
 * Automatically creates tickets when Zabbix triggers fire
 * and adds comments when triggers resolve.
 * 
 * Features:
 * - Duplicate prevention (checks for existing open tickets)
 * - Rate limiting (max 10 auto-tickets per host per hour)
 * - Priority mapping (Zabbix severity → ticket priority)
 * - Automatic asset linking
 * - Resolution comments when triggers clear
 */

import { db } from '@/db';
import { tickets, ticketAssets, ticketComments, zabbixConfigs, services, assets } from '@/db/schema';
import { eq, and, desc, gte, notInArray } from 'drizzle-orm';
import { redis } from '@/lib/redis';
import { ZabbixTrigger } from '@/lib/zabbix/client';
import { generateTicketKey } from '@/lib/tickets/keys';

// Rate limit: max 10 auto-tickets per host per hour
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

// Priority mapping: Zabbix → Atlas
const PRIORITY_MAP: Record<string, string> = {
  '5': 'P1', // Disaster
  '4': 'P2', // High
  '3': 'P3', // Average
  '2': 'P3', // Warning
  '1': 'P4', // Information
  '0': 'P4', // Not classified
};

interface TriggerEvent {
  triggerId: string;
  hostId: string;
  hostName: string;
  description: string;
  priority: string;
  value: '0' | '1'; // 0 = OK, 1 = Problem
  lastchange: string;
}

/**
 * Check if auto-ticket creation is enabled for an org
 */
export async function isAutoTicketEnabled(orgId: string): Promise<boolean> {
  const config = await db.query.zabbixConfigs.findFirst({
    where: eq(zabbixConfigs.orgId, orgId),
    columns: {
      isActive: true,
      // We'll add autoCreateTickets column to schema
    },
  });

  // Default to true if Zabbix is active (can be changed per org)
  return config?.isActive ?? false;
}

/**
 * Get rate limit key for a host
 */
function getRateLimitKey(hostId: string): string {
  return `zabbix:auto-ticket:${hostId}:${Math.floor(Date.now() / 1000 / RATE_LIMIT_WINDOW_SECONDS)}`;
}

/**
 * Check rate limit for auto-ticket creation
 */
async function checkRateLimit(hostId: string): Promise<boolean> {
  if (!redis) return true; // If no Redis, allow (but log warning)

  const key = getRateLimitKey(hostId);
  const current = await redis.incr(key);
  
  // Set expiry on first increment
  if (current === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  }

  return current <= RATE_LIMIT_MAX;
}

/**
 * Check if an open ticket already exists for this trigger
 */
async function findExistingTicket(
  orgId: string,
  triggerId: string
): Promise<{ id: string; key: string } | null> {
  // Look for tickets created in last 24 hours with matching trigger reference
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const existingTickets = await db.query.tickets.findMany({
    where: and(
      eq(tickets.orgId, orgId),
      gte(tickets.createdAt, oneDayAgo),
      notInArray(tickets.status, ['RESOLVED', 'CLOSED'])
    ),
    orderBy: [desc(tickets.createdAt)],
    limit: 10,
  });

  // Check ticket comments for trigger reference
  for (const ticket of existingTickets) {
    const comments = await db.query.ticketComments.findMany({
      where: eq(ticketComments.ticketId, ticket.id),
      orderBy: [desc(ticketComments.createdAt)],
      limit: 5,
    });

    // Check if any comment mentions this trigger ID
    const hasTriggerRef = comments.some(c => 
      c.content.includes(`[ZBX-${triggerId}]`) || 
      c.content.includes(`Trigger ID: ${triggerId}`)
    );

    if (hasTriggerRef) {
      return { id: ticket.id, key: ticket.key };
    }
  }

  return null;
}

/**
 * Find asset linked to a Zabbix host
 */
async function findLinkedZabbixResources(
  orgId: string,
  zabbixHostId: string
): Promise<{ serviceId: string | null; assetId: string | null }> {
  // First check services
  const service = await db.query.services.findFirst({
    where: and(
      eq(services.orgId, orgId),
      eq(services.zabbixHostId, zabbixHostId)
    ),
  });

  // Then check assets
  const asset = await db.query.assets.findFirst({
    where: and(
      eq(assets.orgId, orgId),
      eq(assets.zabbixHostId, zabbixHostId)
    ),
  });

  return {
    serviceId: service?.id || null,
    assetId: asset?.id || null,
  };
}

/**
 * Create a ticket from a Zabbix trigger
 */
export async function createTicketFromTrigger(
  orgId: string,
  event: TriggerEvent
): Promise<{ success: boolean; ticketId?: string; ticketKey?: string; error?: string }> {
  try {
    // Check if auto-tickets are enabled
    const enabled = await isAutoTicketEnabled(orgId);
    if (!enabled) {
      return { success: false, error: 'Auto-ticket creation disabled' };
    }

    // Rate limit check
    const withinLimit = await checkRateLimit(event.hostId);
    if (!withinLimit) {
      console.warn(`[Auto-Ticket] Rate limit exceeded for host ${event.hostId}`);
      return { success: false, error: 'Rate limit exceeded' };
    }

    // Check for existing ticket
    const existing = await findExistingTicket(orgId, event.triggerId);
    if (existing) {
      console.log(`[Auto-Ticket] Ticket already exists for trigger ${event.triggerId}: ${existing.key}`);
      return { success: false, error: `Ticket already exists: ${existing.key}` };
    }

    // Find linked asset/service
    const linkedResources = await findLinkedZabbixResources(orgId, event.hostId);

    // Map priority
    const priority = PRIORITY_MAP[event.priority] || 'P3';

    // Generate ticket key
    const ticketKey = await generateTicketKey(orgId);

    // Create ticket
    const [ticket] = await db
      .insert(tickets)
      .values({
        orgId,
        key: ticketKey,
        subject: `[AUTO] ${event.description} on ${event.hostName}`,
        description: `This ticket was automatically created by Zabbix monitoring.

Trigger Details:
- Description: ${event.description}
- Host: ${event.hostName}
- Severity: ${getSeverityLabel(event.priority)}
- Trigger ID: [ZBX-${event.triggerId}]
- Host ID: ${event.hostId}
- Detected at: ${new Date(parseInt(event.lastchange) * 1000).toISOString()}

This is an automated alert. Please investigate and update the ticket with findings.`,
        status: 'OPEN',
        priority: priority as 'P1' | 'P2' | 'P3' | 'P4',
        category: 'INCIDENT',
        serviceId: linkedResources.serviceId,
        // No requester for auto-tickets - they're system-generated
        requesterId: null,
      })
      .returning();

    if (linkedResources.assetId) {
      await db
        .insert(ticketAssets)
        .values({
          ticketId: ticket.id,
          assetId: linkedResources.assetId,
        })
        .onConflictDoNothing();
    }

    // Add initial comment with trigger details
    await db.insert(ticketComments).values({
      ticketId: ticket.id,
      content: `🚨 Zabbix Alert Triggered

Trigger: ${event.description}
Host: ${event.hostName}
Severity: ${getSeverityLabel(event.priority)}
Status: PROBLEM
Trigger ID: [ZBX-${event.triggerId}]

This ticket was automatically created when the Zabbix trigger entered a problem state.`,
      isInternal: true,
      // System-generated comment
      userId: null,
    });

    console.log(`[Auto-Ticket] Created ticket ${ticket.key} for trigger ${event.triggerId}`);

    return {
      success: true,
      ticketId: ticket.id,
      ticketKey: ticket.key,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Auto-Ticket] Failed to create ticket:', error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Add resolution comment when trigger clears
 */
export async function addResolutionComment(
  orgId: string,
  event: TriggerEvent
): Promise<{ success: boolean; error?: string }> {
  try {
    // Find the ticket for this trigger
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const existingTickets = await db.query.tickets.findMany({
      where: and(
        eq(tickets.orgId, orgId),
        gte(tickets.createdAt, oneDayAgo),
        eq(tickets.status, 'OPEN')
      ),
      orderBy: [desc(tickets.createdAt)],
      limit: 20,
    });

    // Find ticket with matching trigger reference
    let ticketId: string | null = null;
    for (const ticket of existingTickets) {
      const comments = await db.query.ticketComments.findMany({
        where: eq(ticketComments.ticketId, ticket.id),
        orderBy: [desc(ticketComments.createdAt)],
        limit: 10,
      });

      const hasTriggerRef = comments.some(c => 
        c.content.includes(`[ZBX-${event.triggerId}]`)
      );

      if (hasTriggerRef) {
        ticketId = ticket.id;
        break;
      }
    }

    if (!ticketId) {
      console.log(`[Auto-Ticket] No open ticket found for resolved trigger ${event.triggerId}`);
      return { success: false, error: 'No matching ticket found' };
    }

    // Add resolution comment
    await db.insert(ticketComments).values({
      ticketId,
      content: `✅ Zabbix Alert Resolved

Trigger: ${event.description}
Host: ${event.hostName}
Status: RESOLVED
Resolved at: ${new Date().toISOString()}
Trigger ID: [ZBX-${event.triggerId}]

The Zabbix trigger has returned to a normal state. This may indicate the issue has been resolved or the condition has cleared.`,
      isInternal: true,
      userId: null,
    });

    console.log(`[Auto-Ticket] Added resolution comment to ticket for trigger ${event.triggerId}`);

    return { success: true };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Auto-Ticket] Failed to add resolution comment:', error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Process trigger events from Zabbix sync
 * Called during the sync process for each service
 */
export async function processTriggerEvents(
  orgId: string,
  hostId: string,
  hostName: string,
  triggers: ZabbixTrigger[]
): Promise<Array<{ triggerId: string; action: 'created' | 'resolved' | 'skipped'; ticketKey?: string; error?: string }>> {
  const results: Array<{
    triggerId: string;
    action: 'created' | 'resolved' | 'skipped';
    ticketKey?: string;
    error?: string;
  }> = [];

  for (const trigger of triggers) {
    const event: TriggerEvent = {
      triggerId: trigger.triggerid,
      hostId,
      hostName,
      description: trigger.description,
      priority: trigger.priority,
      value: trigger.value as '0' | '1',
      lastchange: trigger.lastchange,
    };

    if (trigger.value === '1') {
      // Problem - create ticket
      const result = await createTicketFromTrigger(orgId, event);
      results.push({
        triggerId: trigger.triggerid,
        action: result.success ? 'created' : 'skipped',
        ticketKey: result.ticketKey,
        error: result.error,
      });
    } else {
      // Resolved - add comment
      const result = await addResolutionComment(orgId, event);
      results.push({
        triggerId: trigger.triggerid,
        action: result.success ? 'resolved' : 'skipped',
        error: result.error,
      });
    }
  }

  return results;
}

/**
 * Get severity label from priority code
 */
function getSeverityLabel(priority: string): string {
  const labels: Record<string, string> = {
    '5': 'Disaster',
    '4': 'High',
    '3': 'Average',
    '2': 'Warning',
    '1': 'Information',
    '0': 'Not classified',
  };
  return labels[priority] || 'Unknown';
}

/**
 * Get auto-ticket statistics for an org
 */
export async function getAutoTicketStats(orgId: string, hours: number = 24): Promise<{
  totalCreated: number;
  totalResolved: number;
  rateLimited: number;
  duplicatesPrevented: number;
}> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const autoTickets = await db.query.tickets.findMany({
    where: and(
      eq(tickets.orgId, orgId),
      gte(tickets.createdAt, since)
    ),
    columns: {
      id: true,
      subject: true,
    },
  });

  const zabbixTickets = autoTickets.filter((ticket) => ticket.subject.startsWith('[AUTO]'));

  return {
    totalCreated: zabbixTickets.length,
    totalResolved: 0, // Would need to track this separately
    rateLimited: 0,   // Would need to track this separately
    duplicatesPrevented: 0, // Would need to track this separately
  };
}
