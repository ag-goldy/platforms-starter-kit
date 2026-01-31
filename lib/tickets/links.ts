/**
 * Ticket linking functionality
 * 
 * Manages bidirectional relationships between tickets
 */

import { db } from '@/db';
import { ticketLinks } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export type LinkType = 'related' | 'duplicate' | 'blocks' | 'blocked_by';

export interface TicketLink {
  id: string;
  sourceTicketId: string;
  targetTicketId: string;
  linkType: LinkType;
  createdBy: string | null;
  createdAt: Date;
}

/**
 * Create a link between two tickets
 */
export async function createTicketLink(
  sourceTicketId: string,
  targetTicketId: string,
  linkType: LinkType,
  createdBy: string
): Promise<TicketLink> {
  // Prevent self-linking
  if (sourceTicketId === targetTicketId) {
    throw new Error('Cannot link a ticket to itself');
  }

  // For 'blocks' and 'blocked_by', create bidirectional relationship
  if (linkType === 'blocks') {
    // Create both directions
    const [link1] = await Promise.all([
      db.insert(ticketLinks).values({
        sourceTicketId,
        targetTicketId,
        linkType: 'blocks',
        createdBy,
      }).returning(),
      db.insert(ticketLinks).values({
        sourceTicketId: targetTicketId,
        targetTicketId: sourceTicketId,
        linkType: 'blocked_by',
        createdBy,
      }).returning(),
    ]);
    return link1[0] as TicketLink;
  }

  // For other types, create single link
  const links = await db.insert(ticketLinks).values({
    sourceTicketId,
    targetTicketId,
    linkType,
    createdBy,
  }).returning();

  return links[0] as TicketLink;
}

/**
 * Get all links for a ticket (both as source and target)
 */
export async function getTicketLinks(ticketId: string): Promise<{
  outgoing: TicketLink[];
  incoming: TicketLink[];
}> {
  const [outgoing, incoming] = await Promise.all([
    db.query.ticketLinks.findMany({
      where: eq(ticketLinks.sourceTicketId, ticketId),
    }),
    db.query.ticketLinks.findMany({
      where: eq(ticketLinks.targetTicketId, ticketId),
    }),
  ]);

  return { 
    outgoing: outgoing as TicketLink[],
    incoming: incoming as TicketLink[],
  };
}

/**
 * Remove a link between two tickets
 */
export async function removeTicketLink(
  sourceTicketId: string,
  targetTicketId: string,
  linkType: LinkType
): Promise<void> {
  // For 'blocks', remove both directions
  if (linkType === 'blocks') {
    await Promise.all([
      db.delete(ticketLinks).where(
        and(
          eq(ticketLinks.sourceTicketId, sourceTicketId),
          eq(ticketLinks.targetTicketId, targetTicketId),
          eq(ticketLinks.linkType, 'blocks')
        )
      ),
      db.delete(ticketLinks).where(
        and(
          eq(ticketLinks.sourceTicketId, targetTicketId),
          eq(ticketLinks.targetTicketId, sourceTicketId),
          eq(ticketLinks.linkType, 'blocked_by')
        )
      ),
    ]);
  } else {
    await db.delete(ticketLinks).where(
      and(
        eq(ticketLinks.sourceTicketId, sourceTicketId),
        eq(ticketLinks.targetTicketId, targetTicketId),
        eq(ticketLinks.linkType, linkType)
      )
    );
  }
}

