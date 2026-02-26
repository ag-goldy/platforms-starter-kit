import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { tickets, ticketComments, attachments, users, memberships } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    console.log('Fetching ticket:', id);

    // Get ticket without relations
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, id),
    });

    if (!ticket) {
      console.log('Ticket not found:', id);
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    console.log('Ticket found, orgId:', ticket.orgId);

    // Check if user is a member of the ticket's organization
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.orgId, ticket.orgId),
        eq(memberships.isActive, true)
      ),
    });

    if (!membership) {
      console.log('Access denied: User not member of org', session.user.id, ticket.orgId);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get requester separately
    const requester = ticket.requesterId ? await db.query.users.findFirst({
      where: eq(users.id, ticket.requesterId),
      columns: { id: true, name: true, email: true },
    }) : null;

    // Get assignee separately
    const assignee = ticket.assigneeId ? await db.query.users.findFirst({
      where: eq(users.id, ticket.assigneeId),
      columns: { id: true, name: true, email: true },
    }) : null;

    // Get comments without relations
    const comments = await db.query.ticketComments.findMany({
      where: eq(ticketComments.ticketId, id),
      orderBy: ticketComments.createdAt,
    });

    // Get comment authors separately
    const commentAuthors = await Promise.all(
      comments.map(async (c) => {
        const author = c.authorId ? await db.query.users.findFirst({
          where: eq(users.id, c.authorId),
          columns: { name: true },
        }) : null;
        return {
          id: c.id,
          author: author?.name || 'Unknown',
          content: c.content,
          isInternal: c.isInternal || false,
          createdAt: c.createdAt,
        };
      })
    );

    // Get attachments
    const ticketAttachments = await db.query.attachments.findMany({
      where: eq(attachments.ticketId, id),
    });

    console.log('Ticket data assembled:', {
      id: ticket.id,
      key: ticket.key,
      comments: commentAuthors.length,
      attachments: ticketAttachments.length,
    });

    return NextResponse.json({
      id: ticket.id,
      key: ticket.key,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      description: ticket.description,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      orgId: ticket.orgId,
      requester: {
        name: requester?.name || requester?.email?.split('@')[0] || 'Unknown',
        email: requester?.email || '',
      },
      assignee: assignee ? {
        name: assignee.name || assignee.email?.split('@')[0] || 'Unknown',
      } : undefined,
      comments: commentAuthors,
      attachments: ticketAttachments.map((a) => ({
        id: a.id,
        name: a.filename,
        size: a.sizeBytes,
        url: a.url,
      })),
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ticket', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
