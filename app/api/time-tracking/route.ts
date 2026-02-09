import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getUserActiveTimer,
  startTimer,
  stopTimer,
  pauseTimer,
  getUserTimeEntries,
  createManualTimeEntry,
} from '@/lib/time-tracking/queries';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const ticketId = searchParams.get('ticketId');
    const view = searchParams.get('view'); // 'active', 'history'

    if (view === 'active') {
      const timer = await getUserActiveTimer(session.user.id);
      return NextResponse.json({ timer });
    }

    if (ticketId) {
      // Get time entries for specific ticket
      const { getTicketTimeEntries } = await import('@/lib/time-tracking/queries');
      const entries = await getTicketTimeEntries(ticketId);
      return NextResponse.json({ entries });
    }

    // Get user's time entries
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const orgId = searchParams.get('orgId');

    const entries = await getUserTimeEntries(session.user.id, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      orgId: orgId || undefined,
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Error fetching time tracking data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time tracking data' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'start': {
        const { ticketId, orgId, description, isBillable } = body;
        if (!ticketId || !orgId) {
          return NextResponse.json(
            { error: 'Ticket ID and Org ID required' },
            { status: 400 }
          );
        }
        const result = await startTimer({
          ticketId,
          orgId,
          userId: session.user.id,
          description,
          isBillable,
        });
        return NextResponse.json(result);
      }

      case 'stop': {
        const { ticketId } = body;
        if (!ticketId) {
          return NextResponse.json(
            { error: 'Ticket ID required' },
            { status: 400 }
          );
        }
        const result = await stopTimer({
          ticketId,
          userId: session.user.id,
        });
        if (!result) {
          return NextResponse.json(
            { error: 'No active timer found' },
            { status: 404 }
          );
        }
        return NextResponse.json(result);
      }

      case 'pause': {
        const { ticketId } = body;
        if (!ticketId) {
          return NextResponse.json(
            { error: 'Ticket ID required' },
            { status: 400 }
          );
        }
        const timer = await pauseTimer(ticketId, session.user.id);
        return NextResponse.json({ timer });
      }

      case 'manual': {
        const { ticketId, orgId, startedAt, endedAt, description, isBillable, hourlyRate } = body;
        if (!ticketId || !orgId || !startedAt || !endedAt) {
          return NextResponse.json(
            { error: 'Required fields missing' },
            { status: 400 }
          );
        }
        const entry = await createManualTimeEntry({
          ticketId,
          orgId,
          userId: session.user.id,
          startedAt: new Date(startedAt),
          endedAt: new Date(endedAt),
          description,
          isBillable,
          hourlyRate,
        });
        return NextResponse.json({ entry });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing time tracking action:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}
