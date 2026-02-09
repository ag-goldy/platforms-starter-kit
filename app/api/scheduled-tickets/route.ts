import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  createScheduledTicket,
  getOrgScheduledTickets,
  getUpcomingScheduledTicketsCount,
} from '@/lib/scheduled-tickets/queries';
import { requireOrgAccess } from '@/lib/auth/permissions';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    const hasAccess = await requireOrgAccess(session.user.id, orgId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const status = searchParams.get('status');
    const view = searchParams.get('view');

    if (view === 'upcoming_count') {
      const count = await getUpcomingScheduledTicketsCount(orgId);
      return NextResponse.json({ count });
    }

    const tickets = await getOrgScheduledTickets(orgId, {
      status: status || undefined,
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error('Error fetching scheduled tickets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled tickets' },
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
    const {
      orgId,
      scheduledFor,
      timezone,
      subject,
      description,
      priority,
      category,
      requesterId,
      requesterEmail,
      assigneeId,
      serviceId,
      siteId,
      areaId,
      ccEmails,
      tags,
      customFields,
      recurrencePattern,
      recurrenceEndDate,
    } = body;

    if (!orgId || !scheduledFor || !subject || !description) {
      return NextResponse.json(
        { error: 'Required fields missing' },
        { status: 400 }
      );
    }

    const hasAccess = await requireOrgAccess(session.user.id, orgId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const scheduled = await createScheduledTicket({
      orgId,
      createdBy: session.user.id,
      scheduledFor: new Date(scheduledFor),
      timezone,
      subject,
      description,
      priority,
      category,
      requesterId,
      requesterEmail,
      assigneeId,
      serviceId,
      siteId,
      areaId,
      ccEmails,
      tags,
      customFields,
      recurrencePattern,
      recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : undefined,
    });

    return NextResponse.json({ scheduledTicket: scheduled });
  } catch (error) {
    console.error('Error creating scheduled ticket:', error);
    return NextResponse.json(
      { error: 'Failed to create scheduled ticket' },
      { status: 500 }
    );
  }
}
