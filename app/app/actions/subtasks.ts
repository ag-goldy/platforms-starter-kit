'use server';

import { db } from '@/db';
import { ticketSubtasks, tickets } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/permissions';

export async function getSubtasksAction(ticketId: string) {
  const subtasks = await db.query.ticketSubtasks.findMany({
    where: eq(ticketSubtasks.ticketId, ticketId),
    orderBy: (subtasks, { asc }) => [asc(subtasks.sortOrder)],
    with: {
      assignee: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  return subtasks;
}

export async function addSubtaskAction(
  ticketId: string,
  data: {
    title: string;
    description?: string;
    assigneeId?: string;
    dueDate?: Date;
  }
) {
  await requireAuth();

  // Get current max sort order
  const existingSubtasks = await db.query.ticketSubtasks.findMany({
    where: eq(ticketSubtasks.ticketId, ticketId),
    orderBy: (subtasks, { desc }) => [desc(subtasks.sortOrder)],
    limit: 1,
  });

  const sortOrder = existingSubtasks.length > 0 ? existingSubtasks[0].sortOrder + 1 : 0;

  // Get ticket to find orgId
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: { orgId: true },
  });

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  const [subtask] = await db
    .insert(ticketSubtasks)
    .values({
      ticketId,
      orgId: ticket.orgId!,
      title: data.title,
      description: data.description || null,
      assigneeId: data.assigneeId || null,
      dueDate: data.dueDate || null,
      status: 'todo',
      sortOrder,
    })
    .returning();

  revalidatePath(`/app/tickets/${ticketId}`);
  return subtask;
}

export async function updateSubtaskAction(
  ticketId: string,
  subtaskId: string,
  updates: {
    title?: string;
    description?: string;
    assigneeId?: string | null;
    dueDate?: Date | null;
    status?: 'todo' | 'in_progress' | 'done';
    sortOrder?: number;
  }
) {
  await requireAuth();

  const [subtask] = await db
    .update(ticketSubtasks)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(ticketSubtasks.id, subtaskId),
        eq(ticketSubtasks.ticketId, ticketId)
      )
    )
    .returning();

  revalidatePath(`/app/tickets/${ticketId}`);
  return subtask;
}

export async function deleteSubtaskAction(ticketId: string, subtaskId: string) {
  await requireAuth();

  await db
    .delete(ticketSubtasks)
    .where(
      and(
        eq(ticketSubtasks.id, subtaskId),
        eq(ticketSubtasks.ticketId, ticketId)
      )
    );

  revalidatePath(`/app/tickets/${ticketId}`);
}

export async function reorderSubtasksAction(
  ticketId: string,
  orderedIds: string[]
) {
  await requireAuth();

  // Update sort orders in a transaction
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(ticketSubtasks)
      .set({ sortOrder: i })
      .where(
        and(
          eq(ticketSubtasks.id, orderedIds[i]),
          eq(ticketSubtasks.ticketId, ticketId)
        )
      );
  }

  revalidatePath(`/app/tickets/${ticketId}`);
}
