'use server';

import { db } from '@/db';
import { tickets, ticketComments, ticketMerges, ticketTagAssignments } from '@/db/schema';
import { requireInternalRole, canViewTicket } from '@/lib/auth/permissions';
import { logAudit } from '@/lib/audit/log';
import { eq, and } from 'drizzle-orm';

export async function mergeTicketsAction(sourceTicketId: string, targetTicketId: string) {
  const user = await requireInternalRole();
  
  // Verify both tickets exist and user can view them
  const [sourceTicket, targetTicket] = await Promise.all([
    canViewTicket(sourceTicketId),
    canViewTicket(targetTicketId),
  ]);

  if (!sourceTicket.ticket || !targetTicket.ticket) {
    throw new Error('One or both tickets not found');
  }

  // Prevent merging a ticket into itself
  if (sourceTicketId === targetTicketId) {
    throw new Error('Cannot merge a ticket into itself');
  }

  // Prevent merging if source is already merged
  if (sourceTicket.ticket.mergedIntoId) {
    throw new Error('Source ticket is already merged into another ticket');
  }

  // Prevent merging if target is already merged
  if (targetTicket.ticket.mergedIntoId) {
    throw new Error('Target ticket is already merged into another ticket');
  }

  // Prevent merging tickets from different organizations
  if (sourceTicket.ticket.orgId !== targetTicket.ticket.orgId) {
    throw new Error('Cannot merge tickets from different organizations');
  }

  return await db.transaction(async (tx) => {
    // Move all comments from source to target
    await tx
      .update(ticketComments)
      .set({ ticketId: targetTicketId })
      .where(eq(ticketComments.ticketId, sourceTicketId));

    // Move all tag assignments from source to target
    const sourceTags = await tx.query.ticketTagAssignments.findMany({
      where: eq(ticketTagAssignments.ticketId, sourceTicketId),
    });

    for (const tagAssignment of sourceTags) {
      // Check if tag already exists on target
      const existing = await tx.query.ticketTagAssignments.findFirst({
        where: and(
          eq(ticketTagAssignments.ticketId, targetTicketId),
          eq(ticketTagAssignments.tagId, tagAssignment.tagId)
        ),
      });

      if (!existing) {
        // Move the tag assignment
        await tx
          .update(ticketTagAssignments)
          .set({ ticketId: targetTicketId })
          .where(eq(ticketTagAssignments.id, tagAssignment.id));
      } else {
        // Delete duplicate tag assignment
        await tx
          .delete(ticketTagAssignments)
          .where(eq(ticketTagAssignments.id, tagAssignment.id));
      }
    }

    // Add a comment to target ticket indicating the merge
    await tx.insert(ticketComments).values({
      ticketId: targetTicketId,
      userId: user.id,
      content: `Merged ticket ${sourceTicket.ticket.key} into this ticket.`,
      isInternal: true,
    });

    // Add a comment to source ticket indicating it was merged
    await tx.insert(ticketComments).values({
      ticketId: sourceTicketId,
      userId: user.id,
      content: `This ticket was merged into ${targetTicket.ticket.key}.`,
      isInternal: true,
    });

    // Mark source ticket as merged
    await tx
      .update(tickets)
      .set({ mergedIntoId: targetTicketId, updatedAt: new Date() })
      .where(eq(tickets.id, sourceTicketId));

    // Record the merge
    await tx.insert(ticketMerges).values({
      sourceTicketId,
      targetTicketId,
      mergedById: user.id,
    });

    // Audit log
    await logAudit({
      userId: user.id,
      orgId: sourceTicket.ticket.orgId,
      ticketId: targetTicketId,
      action: 'TICKET_MERGED',
      details: JSON.stringify({
        sourceTicketId,
        sourceTicketKey: sourceTicket.ticket.key,
        targetTicketKey: targetTicket.ticket.key,
      }),
    });

    await logAudit({
      userId: user.id,
      orgId: sourceTicket.ticket.orgId,
      ticketId: sourceTicketId,
      action: 'TICKET_MERGED',
      details: JSON.stringify({
        targetTicketId,
        targetTicketKey: targetTicket.ticket.key,
      }),
    });
  });
}

export async function getMergeableTicketsAction(ticketId: string) {
  await requireInternalRole();
  const { ticket } = await canViewTicket(ticketId);

  // Get all tickets from the same org that aren't already merged
  const allTickets = await db.query.tickets.findMany({
    where: eq(tickets.orgId, ticket.orgId),
    columns: {
      id: true,
      key: true,
      subject: true,
      status: true,
      mergedIntoId: true,
    },
    orderBy: (tickets, { desc }) => [desc(tickets.createdAt)],
    limit: 100,
  });

  // Filter out tickets that are already merged and the current ticket
  const mergeableTickets = allTickets.filter(
    (t) => !t.mergedIntoId && t.id !== ticketId
  );

  // Filter out the current ticket
  return mergeableTickets.filter((t) => t.id !== ticketId);
}
