import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { tickets, memberships, ticketComments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    // Get ticket
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, id),
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Check membership
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

    // Update ticket - escalate to P1 and mark as escalated
    const [updated] = await db
      .update(tickets)
      .set({
        priority: 'P1',
        status: 'OPEN',
        escalatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, id))
      .returning();

    // Add a comment about the escalation
    await db.insert(ticketComments).values({
      ticketId: id,
      authorId: session.user.id,
      content: `Ticket escalated to P1. Reason: ${reason || 'Customer request'}`,
      isInternal: false,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error escalating ticket:', error);
    return NextResponse.json(
      { error: 'Failed to escalate ticket' },
      { status: 500 }
    );
  }
}
