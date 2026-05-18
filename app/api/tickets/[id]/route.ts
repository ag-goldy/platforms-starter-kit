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

    // Get ticket without relations
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, id),
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (!ticket.orgId) {
      return NextResponse.json({ error: 'Public tickets cannot be fetched through this endpoint' }, { status: 400 });
    }

    // Check if user is a member of the ticket's organization
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.orgId, ticket.orgId),
        eq(memberships.isActive, true)
      ),
    });

    if (!membership) {
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
        const author = c.userId ? await db.query.users.findFirst({
          where: eq(users.id, c.userId),
          columns: { name: true, email: true },
        }) : null;
        return {
          id: c.id,
          author: author?.name || c.authorEmail || 'Unknown',
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
        size: a.size,
        url: `/api/attachments/${a.id}`,
      })),
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ticket' },
      { status: 500 }
    );
  }
}
