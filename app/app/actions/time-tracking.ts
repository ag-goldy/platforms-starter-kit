"use server";

import { db } from "@/db";
import { timeEntries, tickets, activeTimers } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/permissions";

export async function getTimeEntriesAction(ticketId: string) {
  await requireAuth();

  const entries = await db.query.timeEntries.findMany({
    where: eq(timeEntries.ticketId, ticketId),
    orderBy: (entries, { desc }) => [desc(entries.startedAt)],
    with: {
      user: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  return entries;
}

export async function addTimeEntryAction(
  ticketId: string,
  data: {
    durationMinutes: number;
    description?: string;
    isBillable?: boolean;
    hourlyRate?: number;
  },
) {
  const user = await requireAuth();

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: { orgId: true },
  });

  if (!ticket) {
    throw new Error("Ticket not found");
  }

  const endedAt = new Date();
  const startedAt = new Date(
    endedAt.getTime() - data.durationMinutes * 60 * 1000,
  );

  const [entry] = await db
    .insert(timeEntries)
    .values({
      ticketId,
      orgId: ticket.orgId!,
      userId: user.id,
      startedAt,
      endedAt,
      durationMinutes: data.durationMinutes,
      description: data.description || null,
      isBillable: data.isBillable ?? true,
      hourlyRate: data.hourlyRate || null,
    })
    .returning();

  revalidatePath(`/app/tickets/${ticketId}`);
  return entry;
}

export async function deleteTimeEntryAction(ticketId: string, entryId: string) {
  const user = await requireAuth();

  await db
    .delete(timeEntries)
    .where(
      and(
        eq(timeEntries.id, entryId),
        eq(timeEntries.ticketId, ticketId),
        eq(timeEntries.userId, user.id),
      ),
    );

  revalidatePath(`/app/tickets/${ticketId}`);
}

// Active timer management using Redis or database
export async function startTimerAction(ticketId: string, description?: string) {
  const user = await requireAuth();

  // Check if timer already exists
  const existing = await db.query.activeTimers.findFirst({
    where: and(
      eq(activeTimers.ticketId, ticketId),
      eq(activeTimers.userId, user.id),
    ),
  });

  if (existing) {
    // Resume existing timer
    const [updated] = await db
      .update(activeTimers)
      .set({
        lastResumedAt: new Date(),
      })
      .where(eq(activeTimers.id, existing.id))
      .returning();
    revalidatePath(`/app/tickets/${ticketId}`);
    return updated;
  }

  // Create new timer
  const [timer] = await db
    .insert(activeTimers)
    .values({
      ticketId,
      userId: user.id,
      description: description || null,
      isBillable: true,
    })
    .returning();

  revalidatePath(`/app/tickets/${ticketId}`);
  return timer;
}

export async function stopTimerAction(ticketId: string, entryId: string) {
  const user = await requireAuth();

  const endedAt = new Date();

  // Get the entry to calculate duration
  const entry = await db.query.timeEntries.findFirst({
    where: and(
      eq(timeEntries.id, entryId),
      eq(timeEntries.ticketId, ticketId),
      eq(timeEntries.userId, user.id),
    ),
  });

  if (!entry || entry.endedAt) {
    throw new Error("Timer not found or already stopped");
  }

  const durationMinutes = Math.round(
    (endedAt.getTime() - new Date(entry.startedAt).getTime()) / (1000 * 60),
  );

  const [updated] = await db
    .update(timeEntries)
    .set({
      endedAt,
      durationMinutes,
    })
    .where(eq(timeEntries.id, entryId))
    .returning();

  revalidatePath(`/app/tickets/${ticketId}`);
  return updated;
}

export async function getActiveTimerAction(ticketId: string) {
  const user = await requireAuth();

  const entry = await db.query.timeEntries.findFirst({
    where: and(
      eq(timeEntries.ticketId, ticketId),
      eq(timeEntries.userId, user.id),
      isNull(timeEntries.endedAt),
    ),
  });

  return entry || null;
}
