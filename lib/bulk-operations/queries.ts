import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/db';
import { bulkOperations, tickets, ticketTagAssignments } from '@/db/schema';

export type BulkOperationType = 'assign' | 'status_change' | 'priority_change' | 'add_tags' | 'remove_tags' | 'merge' | 'close' | 'delete';
export type BulkOperationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'partial';

export interface CreateBulkOperationInput {
  orgId: string;
  userId: string;
  type: BulkOperationType;
  ticketIds: string[];
  data: Record<string, unknown>;
}

export interface BulkOperationResult {
  success: boolean;
  processedCount: number;
  successCount: number;
  failureCount: number;
  errors: Array<{ ticketId: string; error: string }>;
}

/**
 * Create a bulk operation record
 */
export async function createBulkOperation(input: CreateBulkOperationInput) {
  const [operation] = await db
    .insert(bulkOperations)
    .values({
      orgId: input.orgId,
      userId: input.userId,
      type: input.type,
      ticketIds: input.ticketIds,
      ticketCount: input.ticketIds.length,
      data: input.data,
      status: 'pending',
    })
    .returning();

  return operation;
}

/**
 * Get bulk operation by ID
 */
export async function getBulkOperationById(id: string) {
  const [operation] = await db
    .select()
    .from(bulkOperations)
    .where(eq(bulkOperations.id, id));

  return operation;
}

/**
 * Get bulk operations for an organization
 */
export async function getOrgBulkOperations(
  orgId: string,
  options: { limit?: number; offset?: number } = {}
) {
  const { limit = 50, offset = 0 } = options;

  return await db
    .select()
    .from(bulkOperations)
    .where(eq(bulkOperations.orgId, orgId))
    .orderBy(sql`${bulkOperations.createdAt} DESC`)
    .limit(limit)
    .offset(offset);
}

/**
 * Update bulk operation status
 */
export async function updateBulkOperationStatus(
  id: string,
  status: BulkOperationStatus,
  result?: Partial<BulkOperationResult>
) {
  const updates: Record<string, unknown> = { status };

  if (result) {
    if (result.processedCount !== undefined) updates.processedCount = result.processedCount;
    if (result.successCount !== undefined) updates.successCount = result.successCount;
    if (result.failureCount !== undefined) updates.failureCount = result.failureCount;
    if (result.errors !== undefined) updates.errors = result.errors;
  }

  if (status === 'running') {
    updates.startedAt = new Date();
  } else if (['completed', 'failed', 'partial'].includes(status)) {
    updates.completedAt = new Date();
  }

  const [operation] = await db
    .update(bulkOperations)
    .set(updates)
    .where(eq(bulkOperations.id, id))
    .returning();

  return operation;
}

/**
 * Execute bulk assign operation
 */
export async function bulkAssignTickets(
  ticketIds: string[],
  assigneeId: string,
  orgId: string
): Promise<BulkOperationResult> {
  const errors: Array<{ ticketId: string; error: string }> = [];
  let successCount = 0;

  for (const ticketId of ticketIds) {
    try {
      // Verify ticket belongs to org
      const [ticket] = await db
        .select({ id: tickets.id })
        .from(tickets)
        .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)));

      if (!ticket) {
        errors.push({ ticketId, error: 'Ticket not found or access denied' });
        continue;
      }

      await db
        .update(tickets)
        .set({
          assigneeId,
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, ticketId));

      successCount++;
    } catch (error) {
      errors.push({
        ticketId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: errors.length === 0,
    processedCount: ticketIds.length,
    successCount,
    failureCount: errors.length,
    errors,
  };
}

/**
 * Execute bulk status change operation
 */
export async function bulkChangeStatus(
  ticketIds: string[],
  status: string,
  orgId: string
): Promise<BulkOperationResult> {
  const errors: Array<{ ticketId: string; error: string }> = [];
  let successCount = 0;

  for (const ticketId of ticketIds) {
    try {
      const [ticket] = await db
        .select({ id: tickets.id })
        .from(tickets)
        .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)));

      if (!ticket) {
        errors.push({ ticketId, error: 'Ticket not found or access denied' });
        continue;
      }

      const updates: Record<string, unknown> = {
        status: status as 'NEW' | 'OPEN' | 'WAITING_ON_CUSTOMER' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
        updatedAt: new Date(),
      };

      if (status === 'RESOLVED') {
        updates.resolvedAt = new Date();
      }

      await db
        .update(tickets)
        .set(updates)
        .where(eq(tickets.id, ticketId));

      successCount++;
    } catch (error) {
      errors.push({
        ticketId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: errors.length === 0,
    processedCount: ticketIds.length,
    successCount,
    failureCount: errors.length,
    errors,
  };
}

/**
 * Execute bulk priority change operation
 */
export async function bulkChangePriority(
  ticketIds: string[],
  priority: string,
  orgId: string
): Promise<BulkOperationResult> {
  const errors: Array<{ ticketId: string; error: string }> = [];
  let successCount = 0;

  for (const ticketId of ticketIds) {
    try {
      const [ticket] = await db
        .select({ id: tickets.id })
        .from(tickets)
        .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)));

      if (!ticket) {
        errors.push({ ticketId, error: 'Ticket not found or access denied' });
        continue;
      }

      await db
        .update(tickets)
        .set({
          priority: priority as 'P1' | 'P2' | 'P3' | 'P4',
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, ticketId));

      successCount++;
    } catch (error) {
      errors.push({
        ticketId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: errors.length === 0,
    processedCount: ticketIds.length,
    successCount,
    failureCount: errors.length,
    errors,
  };
}

/**
 * Execute bulk add tags operation
 */
export async function bulkAddTags(
  ticketIds: string[],
  tagIds: string[],
  assignedById: string,
  orgId: string
): Promise<BulkOperationResult> {
  const errors: Array<{ ticketId: string; error: string }> = [];
  let successCount = 0;

  for (const ticketId of ticketIds) {
    try {
      const [ticket] = await db
        .select({ id: tickets.id })
        .from(tickets)
        .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)));

      if (!ticket) {
        errors.push({ ticketId, error: 'Ticket not found or access denied' });
        continue;
      }

      // Add each tag (ignore duplicates)
      for (const tagId of tagIds) {
        await db.execute(sql`
          INSERT INTO ticket_tag_assignments (ticket_id, tag_id, assigned_by_id)
          VALUES (${ticketId}, ${tagId}, ${assignedById})
          ON CONFLICT (ticket_id, tag_id) DO NOTHING
        `);
      }

      successCount++;
    } catch (error) {
      errors.push({
        ticketId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: errors.length === 0,
    processedCount: ticketIds.length,
    successCount,
    failureCount: errors.length,
    errors,
  };
}

/**
 * Execute bulk remove tags operation
 */
export async function bulkRemoveTags(
  ticketIds: string[],
  tagIds: string[],
  orgId: string
): Promise<BulkOperationResult> {
  const errors: Array<{ ticketId: string; error: string }> = [];
  let successCount = 0;

  for (const ticketId of ticketIds) {
    try {
      const [ticket] = await db
        .select({ id: tickets.id })
        .from(tickets)
        .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)));

      if (!ticket) {
        errors.push({ ticketId, error: 'Ticket not found or access denied' });
        continue;
      }

      await db
        .delete(ticketTagAssignments)
        .where(
          and(
            eq(ticketTagAssignments.ticketId, ticketId),
            sql`${ticketTagAssignments.tagId} = ANY(${tagIds})`
          )
        );

      successCount++;
    } catch (error) {
      errors.push({
        ticketId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: errors.length === 0,
    processedCount: ticketIds.length,
    successCount,
    failureCount: errors.length,
    errors,
  };
}

/**
 * Execute bulk close tickets operation
 */
export async function bulkCloseTickets(
  ticketIds: string[],
  orgId: string
): Promise<BulkOperationResult> {
  const errors: Array<{ ticketId: string; error: string }> = [];
  let successCount = 0;

  for (const ticketId of ticketIds) {
    try {
      const [ticket] = await db
        .select({ id: tickets.id })
        .from(tickets)
        .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)));

      if (!ticket) {
        errors.push({ ticketId, error: 'Ticket not found or access denied' });
        continue;
      }

      await db
        .update(tickets)
        .set({
          status: 'CLOSED',
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, ticketId));

      successCount++;
    } catch (error) {
      errors.push({
        ticketId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: errors.length === 0,
    processedCount: ticketIds.length,
    successCount,
    failureCount: errors.length,
    errors,
  };
}

/**
 * Process a bulk operation
 */
export async function processBulkOperation(operationId: string): Promise<BulkOperationResult> {
  const operation = await getBulkOperationById(operationId);
  if (!operation) {
    throw new Error('Bulk operation not found');
  }

  // Mark as running
  await updateBulkOperationStatus(operationId, 'running');

  let result: BulkOperationResult;

  // Type assertion for operation data
  const data = operation.data as Record<string, unknown>;

  try {
    switch (operation.type) {
      case 'assign':
        result = await bulkAssignTickets(
          operation.ticketIds,
          data.assigneeId as string,
          operation.orgId
        );
        break;

      case 'status_change':
        result = await bulkChangeStatus(
          operation.ticketIds,
          data.status as string,
          operation.orgId
        );
        break;

      case 'priority_change':
        result = await bulkChangePriority(
          operation.ticketIds,
          data.priority as string,
          operation.orgId
        );
        break;

      case 'add_tags':
        result = await bulkAddTags(
          operation.ticketIds,
          data.tagIds as string[],
          operation.userId,
          operation.orgId
        );
        break;

      case 'remove_tags':
        result = await bulkRemoveTags(
          operation.ticketIds,
          data.tagIds as string[],
          operation.orgId
        );
        break;

      case 'close':
        result = await bulkCloseTickets(operation.ticketIds, operation.orgId);
        break;

      default:
        throw new Error(`Unsupported bulk operation type: ${operation.type}`);
    }

    // Determine final status
    const status: BulkOperationStatus = 
      result.failureCount === 0 ? 'completed' :
      result.successCount === 0 ? 'failed' : 'partial';

    await updateBulkOperationStatus(operationId, status, result);

    return result;
  } catch (error) {
    const errorResult: BulkOperationResult = {
      success: false,
      processedCount: 0,
      successCount: 0,
      failureCount: operation.ticketIds.length,
      errors: [{
        ticketId: 'global',
        error: error instanceof Error ? error.message : 'Unknown error',
      }],
    };

    await updateBulkOperationStatus(operationId, 'failed', errorResult);
    return errorResult;
  }
}
