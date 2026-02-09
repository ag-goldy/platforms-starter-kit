import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { ticketWatchers, users, tickets } from '@/db/schema';
import { canViewTicket } from '@/lib/auth/permissions';
import { eq, and } from 'drizzle-orm';

// GET /api/tickets/[id]/watchers - Get all watchers for a ticket
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if user can view the ticket
    await canViewTicket(id);

    // Get all watchers with user details
    const watchers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: ticketWatchers.createdAt,
      })
      .from(ticketWatchers)
      .innerJoin(users, eq(ticketWatchers.userId, users.id))
      .where(eq(ticketWatchers.ticketId, id));

    return NextResponse.json({ watchers });
  } catch (error) {
    console.error('[Watchers API] Error fetching watchers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch watchers' },
      { status: 500 }
    );
  }
}

// POST /api/tickets/[id]/watchers - Toggle current user as watcher
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;

    // Check if user can view the ticket
    await canViewTicket(id);

    // Check if user is already watching
    const existingWatcher = await db.query.ticketWatchers.findFirst({
      where: and(
        eq(ticketWatchers.ticketId, id),
        eq(ticketWatchers.userId, userId)
      ),
    });

    if (existingWatcher) {
      // Remove watcher
      await db
        .delete(ticketWatchers)
        .where(
          and(
            eq(ticketWatchers.ticketId, id),
            eq(ticketWatchers.userId, userId)
          )
        );

      return NextResponse.json({ watching: false });
    } else {
      // Add watcher
      await db.insert(ticketWatchers).values({
        ticketId: id,
        userId: userId,
      });

      return NextResponse.json({ watching: true });
    }
  } catch (error) {
    console.error('[Watchers API] Error toggling watcher:', error);
    return NextResponse.json(
      { error: 'Failed to update watcher status' },
      { status: 500 }
    );
  }
}
