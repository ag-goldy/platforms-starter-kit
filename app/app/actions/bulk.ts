'use server';

import { db } from '@/db';
import { tickets, ticketTagAssignments } from '@/db/schema';
import { requireInternalRole } from '@/lib/auth/permissions';
import { logAudit } from '@/lib/audit/log';
import { revalidatePath } from 'next/cache';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

const ticketIdsSchema = z.array(z.string().uuid()).min(1);

export async function bulkUpdateStatusAction(ticketIds: string[], status: string) {
  const user = await requireInternalRole();
  
  const validatedIds = ticketIdsSchema.parse(ticketIds);
  const validatedStatus = z.enum(['NEW', 'OPEN', 'WAITING_ON_CUSTOMER', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).parse(status);

  const updatedTickets = await db
    .update(tickets)
    .set({ status: validatedStatus, updatedAt: new Date() })
    .where(inArray(tickets.id, validatedIds))
    .returning();

  // Log audit for each ticket
  for (const ticket of updatedTickets) {
    await logAudit({
      userId: user.id,
      orgId: ticket.orgId,
      ticketId: ticket.id,
      action: 'TICKET_STATUS_CHANGED',
      details: JSON.stringify({ newStatus: validatedStatus, bulkUpdate: true }),
    });
  }

  revalidatePath('/app');
  return { updated: updatedTickets.length, error: null };
}

export async function bulkUpdatePriorityAction(ticketIds: string[], priority: string) {
  const user = await requireInternalRole();
  
  const validatedIds = ticketIdsSchema.parse(ticketIds);
  const validatedPriority = z.enum(['P1', 'P2', 'P3', 'P4']).parse(priority);

  const updatedTickets = await db
    .update(tickets)
    .set({ priority: validatedPriority, updatedAt: new Date() })
    .where(inArray(tickets.id, validatedIds))
    .returning();

  // Log audit for each ticket
  for (const ticket of updatedTickets) {
    await logAudit({
      userId: user.id,
      orgId: ticket.orgId,
      ticketId: ticket.id,
      action: 'TICKET_PRIORITY_CHANGED',
      details: JSON.stringify({ priority: validatedPriority, bulkUpdate: true }),
    });
  }

  revalidatePath('/app');
  return { updated: updatedTickets.length, error: null };
}

export async function bulkAssignAction(ticketIds: string[], assigneeId: string | null) {
  const user = await requireInternalRole();
  
  const validatedIds = ticketIdsSchema.parse(ticketIds);
  const validatedAssigneeId = assigneeId ? z.string().uuid().parse(assigneeId) : null;

  const updatedTickets = await db
    .update(tickets)
    .set({ assigneeId: validatedAssigneeId, updatedAt: new Date() })
    .where(inArray(tickets.id, validatedIds))
    .returning();

  // Log audit for each ticket
  for (const ticket of updatedTickets) {
    await logAudit({
      userId: user.id,
      orgId: ticket.orgId,
      ticketId: ticket.id,
      action: 'TICKET_ASSIGNED',
      details: JSON.stringify({ assigneeId: validatedAssigneeId, bulkUpdate: true }),
    });
  }

  revalidatePath('/app');
  return { updated: updatedTickets.length, error: null };
}

export async function bulkAddTagAction(ticketIds: string[], tagId: string) {
  const user = await requireInternalRole();
  const validatedIds = ticketIdsSchema.parse(ticketIds);
  const validatedTagId = z.string().uuid().parse(tagId);

  // Get existing assignments to avoid duplicates
  const existingAssignments = await db.query.ticketTagAssignments.findMany({
    where: inArray(ticketTagAssignments.ticketId, validatedIds),
    columns: {
      ticketId: true,
      tagId: true,
    },
  });

  const existingSet = new Set(
    existingAssignments
      .filter((a) => a.tagId === validatedTagId)
      .map((a) => a.ticketId)
  );

  const ticketsToTag = validatedIds.filter((id) => !existingSet.has(id));

  if (ticketsToTag.length === 0) {
    return { updated: 0, error: null };
  }

  const assignments = ticketsToTag.map((ticketId) => ({
    ticketId,
    tagId: validatedTagId,
    assignedById: user.id,
  }));

  await db.insert(ticketTagAssignments).values(assignments);

  // Log audit for each ticket
  for (const ticketId of ticketsToTag) {
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, ticketId),
    });
    if (ticket) {
      await logAudit({
        userId: user.id,
        orgId: ticket.orgId,
        ticketId,
        action: 'TICKET_TAG_ADDED',
        details: JSON.stringify({ tagId: validatedTagId, bulkUpdate: true }),
      });
    }
  }

  revalidatePath('/app');
  return { updated: ticketsToTag.length, error: null };
}

export async function bulkCloseAction(ticketIds: string[]) {
  const user = await requireInternalRole();
  const validatedIds = ticketIdsSchema.parse(ticketIds);

  const updatedTickets = await db
    .update(tickets)
    .set({ status: 'CLOSED', updatedAt: new Date() })
    .where(inArray(tickets.id, validatedIds))
    .returning();

  // Log audit for each ticket
  for (const ticket of updatedTickets) {
    await logAudit({
      userId: user.id,
      orgId: ticket.orgId,
      ticketId: ticket.id,
      action: 'TICKET_STATUS_CHANGED',
      details: JSON.stringify({ newStatus: 'CLOSED', bulkUpdate: true, bulkClose: true }),
    });
  }

  revalidatePath('/app');
  return { updated: updatedTickets.length, error: null };
}

export async function bulkRemoveTagAction(ticketIds: string[], tagId: string) {
  const user = await requireInternalRole();
  const validatedIds = ticketIdsSchema.parse(ticketIds);
  const validatedTagId = z.string().uuid().parse(tagId);

  const deletedAssignments = await db
    .delete(ticketTagAssignments)
    .where(
      inArray(ticketTagAssignments.ticketId, validatedIds) &&
      eq(ticketTagAssignments.tagId, validatedTagId)
    )
    .returning();

  // Log audit for each ticket
  for (const assignment of deletedAssignments) {
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, assignment.ticketId),
    });
    if (ticket) {
      await logAudit({
        userId: user.id,
        orgId: ticket.orgId,
        ticketId: assignment.ticketId,
        action: 'TICKET_TAG_REMOVED',
        details: JSON.stringify({ tagId: validatedTagId, bulkUpdate: true }),
      });
    }
  }

  revalidatePath('/app');
  return { updated: deletedAssignments.length, error: null };
}

