/**
 * Handler for RECALCULATE_SLA jobs
 */

import type { RecalculateSLAJob } from '../types';
import type { JobResult } from '../types';
import { db } from '@/db';
import { organizations, tickets } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { resolveSLATargets } from '@/lib/tickets/sla';

export async function processRecalculateSLAJob(job: RecalculateSLAJob): Promise<JobResult> {
  try {
    // Idempotency: If processing specific tickets, check if they were recently updated
    // For batch jobs, we'll process anyway (idempotent by nature - setting same values)
    
    const conditions = [];
    
    if (job.data.orgId) {
      conditions.push(eq(tickets.orgId, job.data.orgId));
    }
    
    if (job.data.ticketIds && job.data.ticketIds.length > 0) {
      conditions.push(inArray(tickets.id, job.data.ticketIds));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const ticketsToUpdate = await db.query.tickets.findMany({
      where: whereClause,
      columns: {
        id: true,
        orgId: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        slaResponseTargetHours: true,
        slaResolutionTargetHours: true,
      },
    });

    const orgIds = Array.from(
      new Set(ticketsToUpdate.map((ticket) => ticket.orgId))
    );
    const orgPolicies = orgIds.length
      ? await db.query.organizations.findMany({
          where: inArray(organizations.id, orgIds),
          columns: {
            id: true,
            slaResponseHoursP1: true,
            slaResponseHoursP2: true,
            slaResponseHoursP3: true,
            slaResponseHoursP4: true,
            slaResolutionHoursP1: true,
            slaResolutionHoursP2: true,
            slaResolutionHoursP3: true,
            slaResolutionHoursP4: true,
          },
        })
      : [];

    const policyByOrgId = new Map(orgPolicies.map((org) => [org.id, org]));

    let updated = 0;
    let skipped = 0;

    for (const ticket of ticketsToUpdate) {
      const slaTargets = resolveSLATargets(
        ticket.priority,
        policyByOrgId.get(ticket.orgId)
      );
      
      // Idempotency check: Skip if SLA targets are already set correctly
      // and ticket was updated recently (within last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (
        ticket.slaResponseTargetHours === slaTargets.responseHours &&
        ticket.slaResolutionTargetHours === slaTargets.resolutionHours &&
        ticket.updatedAt > fiveMinutesAgo
      ) {
        skipped++;
        continue;
      }
      
      await db
        .update(tickets)
        .set({
          slaResponseTargetHours: slaTargets.responseHours,
          slaResolutionTargetHours: slaTargets.resolutionHours,
          updatedAt: new Date(), // Update timestamp
        })
        .where(eq(tickets.id, ticket.id));

      updated++;
    }

    return {
      success: true,
      data: {
        updated,
        skipped,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
