import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { organizations, memberships } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subdomain } = await params;
    
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.subdomain, subdomain),
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check membership
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.orgId, org.id),
        eq(memberships.isActive, true)
      ),
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }

    // Get recent activity (mock data for now)
    const activities = [
      {
        id: 'act-1',
        type: 'ticket_created' as const,
        user: { name: 'John Doe' },
        details: 'created a new ticket',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'act-2',
        type: 'ticket_resolved' as const,
        user: { name: 'Jane Smith' },
        details: 'resolved PROJ-1234',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 'act-3',
        type: 'comment_added' as const,
        user: { name: 'Bob Wilson' },
        details: 'commented on PROJ-1235',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
      },
    ];

    // Get online members (mock)
    const onlineMembers = [
      { id: '1', name: 'John Doe', isOnline: true },
      { id: '2', name: 'Jane Smith', isOnline: true },
      { id: '3', name: 'Bob Wilson', isOnline: false },
    ];

    return NextResponse.json({
      activities,
      onlineMembers,
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}
