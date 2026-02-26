'use server';

import { db } from '@/db';
import { tickets, ticketComments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createCustomerTicket(formData: FormData) {
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const orgId = formData.get('orgId') as string;
  const customerId = formData.get('customerId') as string;
  const subdomain = formData.get('subdomain') as string;
  const category = (formData.get('categoryId') as string) || 'INCIDENT';
  const priority = (formData.get('priority') as string) || 'P3';

  if (!title || !description || !orgId || !customerId) {
    throw new Error('Missing required fields');
  }

  // Generate ticket key (e.g., TICK-001)
  const key = `TICK-${Date.now().toString(36).toUpperCase()}`;

  // Map form priority to ticket priority enum
  const priorityMap: Record<string, 'P1' | 'P2' | 'P3' | 'P4'> = {
    'CRITICAL': 'P1',
    'HIGH': 'P2', 
    'MEDIUM': 'P3',
    'LOW': 'P4'
  };
  
  // Validate category is a valid enum value
  const validCategories = ['INCIDENT', 'SERVICE_REQUEST', 'CHANGE_REQUEST'] as const;
  const validCategory = validCategories.includes(category as any) 
    ? category as 'INCIDENT' | 'SERVICE_REQUEST' | 'CHANGE_REQUEST'
    : 'INCIDENT';

  const [ticket] = await db.insert(tickets).values({
    orgId,
    key,
    subject: title,
    description,
    category: validCategory,
    priority: priorityMap[priority] || 'P3',
    status: 'NEW' as const,
    requesterId: customerId,
  }).returning();

  revalidatePath(`/s/${subdomain}/tickets`);
  redirect(`/s/${subdomain}/tickets/${ticket.id}`);
}

export async function addCustomerComment(formData: FormData) {
  const ticketId = formData.get('ticketId') as string;
  const content = formData.get('content') as string;
  const authorId = formData.get('authorId') as string;
  const subdomain = formData.get('subdomain') as string;

  if (!ticketId || !content || !authorId) {
    throw new Error('Missing required fields');
  }

  await db.insert(ticketComments).values({
    ticketId,
    userId: authorId,
    content,
    isInternal: false,
  });

  // Update ticket's updatedAt
  await db.update(tickets)
    .set({ updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));

  revalidatePath(`/s/${subdomain}/tickets/${ticketId}`);
}
