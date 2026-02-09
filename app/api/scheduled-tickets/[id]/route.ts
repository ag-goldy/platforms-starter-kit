import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getScheduledTicketById,
  updateScheduledTicket,
  cancelScheduledTicket,
  deleteScheduledTicket,
} from '@/lib/scheduled-tickets/queries';
import { requireOrgAccess } from '@/lib/auth/permissions';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const scheduled = await getScheduledTicketById(id);

    if (!scheduled) {
      return NextResponse.json(
        { error: 'Scheduled ticket not found' },
        { status: 404 }
      );
    }

    const hasAccess = await requireOrgAccess(session.user.id, scheduled.orgId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ scheduledTicket: scheduled });
  } catch (error) {
    console.error('Error fetching scheduled ticket:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled ticket' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const scheduled = await getScheduledTicketById(id);

    if (!scheduled) {
      return NextResponse.json(
        { error: 'Scheduled ticket not found' },
        { status: 404 }
      );
    }

    const hasAccess = await requireOrgAccess(session.user.id, scheduled.orgId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (scheduled.status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only update pending scheduled tickets' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const updated = await updateScheduledTicket(id, body);

    return NextResponse.json({ scheduledTicket: updated });
  } catch (error) {
    console.error('Error updating scheduled ticket:', error);
    return NextResponse.json(
      { error: 'Failed to update scheduled ticket' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const scheduled = await getScheduledTicketById(id);

    if (!scheduled) {
      return NextResponse.json(
        { error: 'Scheduled ticket not found' },
        { status: 404 }
      );
    }

    const hasAccess = await requireOrgAccess(session.user.id, scheduled.orgId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Cancel if pending, delete otherwise
    if (scheduled.status === 'pending') {
      await cancelScheduledTicket(id, scheduled.orgId);
    } else {
      await deleteScheduledTicket(id, scheduled.orgId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting scheduled ticket:', error);
    return NextResponse.json(
      { error: 'Failed to delete scheduled ticket' },
      { status: 500 }
    );
  }
}
