'use server';

import { db } from '@/db';
import { ticketTags, ticketTagAssignments } from '@/db/schema';
import { requireInternalRole, canViewTicket } from '@/lib/auth/permissions';
import { logAudit } from '@/lib/audit/log';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const tagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export async function createTagAction(data: { name: string; color?: string }) {
  const user = await requireInternalRole();
  const validated = tagSchema.parse(data);

  const [tag] = await db
    .insert(ticketTags)
    .values({
      name: validated.name.trim(),
      color: validated.color || '#3b82f6',
    })
    .returning();

  await logAudit({
    userId: user.id,
    action: 'TICKET_UPDATED',
    details: JSON.stringify({ tagId: tag.id, action: 'TAG_CREATED' }),
  });

  revalidatePath('/app/tags');
  return { tagId: tag.id, error: null };
}

export async function updateTagAction(tagId: string, data: { name: string; color?: string }) {
  const user = await requireInternalRole();
  const validated = tagSchema.parse(data);

  await db
    .update(ticketTags)
    .set({
      name: validated.name.trim(),
      color: validated.color || '#3b82f6',
      // Note: updatedAt would need to be added to schema if we want to track it
    })
    .where(eq(ticketTags.id, tagId));

  await logAudit({
    userId: user.id,
    action: 'TICKET_UPDATED',
    details: JSON.stringify({ tagId, action: 'TAG_UPDATED' }),
  });

  revalidatePath('/app/tags');
  return { error: null };
}

export async function deleteTagAction(tagId: string) {
  const user = await requireInternalRole();

  await db.delete(ticketTags).where(eq(ticketTags.id, tagId));

  await logAudit({
    userId: user.id,
    action: 'TICKET_UPDATED',
    details: JSON.stringify({ tagId, action: 'TAG_DELETED' }),
  });

  revalidatePath('/app/tags');
  return { error: null };
}

export async function assignTagToTicketAction(ticketId: string, tagId: string) {
  const user = await requireInternalRole();
  const { ticket } = await canViewTicket(ticketId);

  // Check if tag is already assigned
  const existing = await db.query.ticketTagAssignments.findFirst({
    where: and(
      eq(ticketTagAssignments.ticketId, ticketId),
      eq(ticketTagAssignments.tagId, tagId)
    ),
  });

  if (existing) {
    return { error: null }; // Already assigned
  }

  await db.insert(ticketTagAssignments).values({
    ticketId,
    tagId,
    assignedById: user.id,
  });

  await logAudit({
    userId: user.id,
    orgId: ticket.orgId,
    ticketId,
    action: 'TICKET_TAG_ADDED',
    details: JSON.stringify({ tagId }),
  });

  revalidatePath(`/app/tickets/${ticketId}`);
  return { error: null };
}

export async function removeTagFromTicketAction(ticketId: string, tagId: string) {
  const user = await requireInternalRole();
  const { ticket } = await canViewTicket(ticketId);

  await db
    .delete(ticketTagAssignments)
    .where(
      and(
        eq(ticketTagAssignments.ticketId, ticketId),
        eq(ticketTagAssignments.tagId, tagId)
      )
    );

  await logAudit({
    userId: user.id,
    orgId: ticket.orgId,
    ticketId,
    action: 'TICKET_TAG_REMOVED',
    details: JSON.stringify({ tagId }),
  });

  revalidatePath(`/app/tickets/${ticketId}`);
  return { error: null };
}

export async function getAllTagsAction() {
  await requireInternalRole();
  return db.query.ticketTags.findMany({
    orderBy: (tags, { asc }) => [asc(tags.name)],
  });
}

export async function getTicketTagsAction(ticketId: string) {
  await requireInternalRole();
  const assignments = await db.query.ticketTagAssignments.findMany({
    where: eq(ticketTagAssignments.ticketId, ticketId),
    with: {
      tag: true,
    },
  });

  return assignments.map((a) => a.tag);
}

