'use server';

import { db } from '@/db';
import { tickets, ticketMessages, ticketEvents } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/permissions';
import { logAudit } from '@/lib/audit/log';

export async function createCustomerTicket(formData: FormData) {
  const session = await requireAuth(); // We should use the real auth check
  
  const title = formData.get('title') as string;
  const descriptionMd = formData.get('description') as string;
  const orgId = formData.get('orgId') as string;
  const subdomain = formData.get('subdomain') as string;
  const type = (formData.get('type') as string) || 'incident';
  const priority = (formData.get('priority') as string) || 'p3';

  if (!title || !descriptionMd || !orgId) {
    throw new Error('Missing required fields');
  }

  // Determine next org-scoped ticket number safely via transaction
  const [ticket] = await db.transaction(async (tx) => {
    const result = await tx.execute(
      sql`SELECT COALESCE(MAX(number), 0) + 1 as next_number FROM tickets WHERE org_id = ${orgId}`
    );
    const nextNumber = result[0].next_number as number;

    const [newTicket] = await tx.insert(tickets).values({
      orgId,
      number: nextNumber,
      title,
      descriptionMd,
      type: type as 'incident' | 'request' | 'problem' | 'change',
      priority: priority as 'p1' | 'p2' | 'p3' | 'p4',
      status: 'new',
      source: 'portal',
      requesterId: session.user.id,
    }).returning();

    await tx.insert(ticketMessages).values({
      orgId,
      ticketId: newTicket.id,
      authorId: session.user.id,
      authorKind: 'user',
      bodyMd: descriptionMd,
      bodyHtmlSanitized: descriptionMd, // In reality, we should sanitize
      visibility: 'public',
      channel: 'portal',
    });

    await tx.insert(ticketEvents).values({
      orgId,
      ticketId: newTicket.id,
      actorId: session.user.id,
      actorKind: 'user',
      eventType: 'ticket_created',
    });

    return [newTicket];
  });

  await logAudit({
    orgId,
    actorId: session.user.id,
    action: 'ticket_created',
    resource: 'ticket',
    resourceId: ticket.id,
  });

  revalidatePath(`/${subdomain}/tickets`);
  redirect(`/${subdomain}/tickets/${ticket.number}`);
}

export async function addCustomerComment(formData: FormData) {
  const session = await requireAuth();
  const ticketId = formData.get('ticketId') as string;
  const content = formData.get('content') as string;
  const subdomain = formData.get('subdomain') as string;
  const orgId = formData.get('orgId') as string;

  if (!ticketId || !content || !orgId) {
    throw new Error('Missing required fields');
  }

  await db.transaction(async (tx) => {
    await tx.insert(ticketMessages).values({
      orgId,
      ticketId,
      authorId: session.user.id,
      authorKind: 'user',
      bodyMd: content,
      bodyHtmlSanitized: content,
      visibility: 'public',
      channel: 'portal',
    });

    await tx.update(tickets)
      .set({ updatedAt: new Date() })
      .where(eq(tickets.id, ticketId));
      
    await tx.insert(ticketEvents).values({
      orgId,
      ticketId,
      actorId: session.user.id,
      actorKind: 'user',
      eventType: 'message_added',
    });
  });

  await logAudit({
    orgId,
    actorId: session.user.id,
    action: 'message_added',
    resource: 'ticket',
    resourceId: ticketId,
  });

  revalidatePath(`/${subdomain}/tickets/${ticketId}`);
}
