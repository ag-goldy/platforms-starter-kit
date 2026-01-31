'use server';

import { requireInternalRole } from '@/lib/auth/permissions';
import { createTicketLink, removeTicketLink, getTicketLinks } from '@/lib/tickets/links';
import { getTicketById } from '@/lib/tickets/queries';
import { canViewTicket } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';
import type { LinkType } from '@/lib/tickets/links';

/**
 * Create a link between two tickets
 */
export async function createTicketLinkAction(
  sourceTicketId: string,
  targetTicketId: string,
  linkType: LinkType
) {
  const user = await requireInternalRole();
  
  // Verify user can view both tickets
  await canViewTicket(sourceTicketId);
  await canViewTicket(targetTicketId);

  await createTicketLink(sourceTicketId, targetTicketId, linkType, user.id);
  revalidatePath(`/app/tickets/${sourceTicketId}`);
  revalidatePath(`/app/tickets/${targetTicketId}`);
  return { success: true };
}

/**
 * Remove a link between two tickets
 */
export async function removeTicketLinkAction(
  sourceTicketId: string,
  targetTicketId: string,
  linkType: LinkType
) {
  await requireInternalRole();
  
  // Verify user can view both tickets
  await canViewTicket(sourceTicketId);
  await canViewTicket(targetTicketId);

  await removeTicketLink(sourceTicketId, targetTicketId, linkType);
  revalidatePath(`/app/tickets/${sourceTicketId}`);
  revalidatePath(`/app/tickets/${targetTicketId}`);
  return { success: true };
}

/**
 * Get all links for a ticket
 */
export async function getTicketLinksAction(ticketId: string) {
  await requireInternalRole();
  await canViewTicket(ticketId);
  
  const links = await getTicketLinks(ticketId);
  
  // Get ticket details for linked tickets
  const outgoingTickets = await Promise.all(
    links.outgoing.map(async (link) => {
      const ticket = await getTicketById(link.targetTicketId);
      return { link, ticket };
    })
  );
  
  const incomingTickets = await Promise.all(
    links.incoming.map(async (link) => {
      const ticket = await getTicketById(link.sourceTicketId);
      return { link, ticket };
    })
  );
  
  return { outgoing: outgoingTickets, incoming: incomingTickets };
}

/**
 * Search tickets for linking
 */
export async function searchTicketsForLinkingAction(
  query: string,
  excludeTicketId: string
) {
  await requireInternalRole();
  
  const { getTickets } = await import('@/lib/tickets/queries');
  const tickets = await getTickets({
    search: query,
  });
  
  return tickets
    .filter((t) => t.id !== excludeTicketId)
    .slice(0, 10)
    .map((t) => ({
      id: t.id,
      key: t.key,
      subject: t.subject,
    }));
}

