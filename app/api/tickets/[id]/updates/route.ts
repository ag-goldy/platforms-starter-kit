import { NextRequest, NextResponse } from 'next/server';
import { requireInternalRole } from '@/lib/auth/permissions';
import { getTicketById } from '@/lib/tickets/queries';
import { getTicketComments } from '@/lib/tickets/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireInternalRole();
    const { id } = await params;

    const ticket = await getTicketById(id);
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const comments = await getTicketComments(id, true);
    const commentCount = comments.length;

    return NextResponse.json({
      updatedAt: ticket.updatedAt.toISOString(),
      commentCount,
      status: ticket.status,
      priority: ticket.priority,
      assigneeId: ticket.assigneeId,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch ticket updates' },
      { status: 500 }
    );
  }
}
