import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { tickets, organizations, memberships, users, ticketComments, attachments } from '@/db/schema';
import { eq, and, desc, or, like } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      console.log('Tickets API: No session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const filter = searchParams.get('filter') || 'all';
    const query = searchParams.get('q');

    console.log('Tickets API: orgId=', orgId, 'filter=', filter, 'user=', session.user.id);

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Verify organization exists
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    if (!org) {
      console.log('Tickets API: Org not found for id:', orgId);
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check membership
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.orgId, orgId),
        eq(memberships.isActive, true)
      ),
    });

    console.log('Tickets API: Membership found:', !!membership, 'role:', membership?.role);

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // Build query conditions
    let conditions = [eq(tickets.orgId, orgId)];

    // Apply filters
    switch (filter) {
      case 'mine':
        conditions.push(eq(tickets.requesterId, session.user.id));
        break;
      case 'waiting':
        conditions.push(eq(tickets.status, 'WAITING_ON_CUSTOMER'));
        break;
      case 'resolved':
        conditions.push(or(
          eq(tickets.status, 'RESOLVED'),
          eq(tickets.status, 'CLOSED')
        ));
        break;
      case 'all':
      default:
        // No additional filter
        break;
    }

    // Apply search query
    if (query) {
      conditions.push(or(
        like(tickets.subject, `%${query}%`),
        like(tickets.key, `%${query}%`)
      ));
    }

    // Fetch tickets
    const ticketList = await db.query.tickets.findMany({
      where: and(...conditions),
      orderBy: desc(tickets.updatedAt),
      limit: 50,
      with: {
        requester: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignee: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log('Tickets API: Found', ticketList.length, 'tickets');

    // Get comment counts
    const ticketsWithCounts = await Promise.all(
      ticketList.map(async (t) => {
        const comments = await db.query.ticketComments.findMany({
          where: eq(ticketComments.ticketId, t.id),
        });
        const attachmentCount = await db.query.attachments.findMany({
          where: eq(attachments.ticketId, t.id),
        });

        return {
          id: t.id,
          key: t.key,
          subject: t.subject,
          status: t.status,
          priority: t.priority,
          category: t.category,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          commentCount: comments.length,
          attachmentCount: attachmentCount.length,
          requester: {
            name: t.requester?.name || t.requester?.email?.split('@')[0] || 'Unknown',
            email: t.requester?.email || '',
          },
          isUnread: Math.random() > 0.7, // Mock - would come from read receipts
        };
      })
    );

    return NextResponse.json({
      tickets: ticketsWithCounts,
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tickets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orgId, subject, description, priority, category } = body;

    if (!orgId || !subject || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check membership
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.orgId, orgId),
        eq(memberships.isActive, true)
      ),
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }

    // Generate ticket key
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });
    const prefix = org?.slug?.toUpperCase().substring(0, 4) || 'TICK';
    const count = await db.query.tickets.findMany({
      where: eq(tickets.orgId, orgId),
    });
    const key = `${prefix}-${1000 + count.length}`;

    // Create ticket
    const [newTicket] = await db.insert(tickets).values({
      orgId,
      key,
      subject,
      description,
      priority: priority || 'P3',
      category: category || 'INCIDENT',
      status: 'NEW',
      requesterId: session.user.id,
    }).returning();

    return NextResponse.json(newTicket, { status: 201 });
  } catch (error) {
    console.error('Error creating ticket:', error);
    return NextResponse.json(
      { error: 'Failed to create ticket' },
      { status: 500 }
    );
  }
}
