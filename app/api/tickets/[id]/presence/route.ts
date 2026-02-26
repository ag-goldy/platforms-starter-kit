import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { ticketEditSessions } from '@/db/schema-extensions';
import { eq, and, gt } from 'drizzle-orm';

// GET - Get active users for a ticket
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ticketId = params.id;

    // Clean up stale sessions (older than 1 minute)
    const oneMinuteAgo = new Date(Date.now() - 60000);
    await db
      .delete(ticketEditSessions)
      .where(and(
        eq(ticketEditSessions.ticketId, ticketId),
        gt(ticketEditSessions.lastActivityAt, oneMinuteAgo)
      ));

    // Get active sessions
    const sessions = await db.query.ticketEditSessions.findMany({
      where: and(
        eq(ticketEditSessions.ticketId, ticketId),
        eq(ticketEditSessions.isActive, true)
      ),
      with: {
        user: true,
      },
    });

    // Filter out current user
    const otherUsers = sessions
      .filter((s) => s.userId !== session.user.id)
      .map((s) => ({
        userId: s.userId,
        userName: s.userName || s.user?.name || 'Unknown',
        userAvatar: s.userAvatar,
        isEditing: false, // Will be enhanced with actual editing detection
      }));

    return NextResponse.json({ users: otherUsers });
  } catch (error) {
    console.error('Error fetching presence:', error);
    return NextResponse.json(
      { error: 'Failed to fetch presence' },
      { status: 500 }
    );
  }
}

// POST - Register presence
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ticketId = params.id;
    const { isEditing } = await req.json();

    // Upsert session
    await db
      .insert(ticketEditSessions)
      .values({
        ticketId,
        userId: session.user.id,
        userName: session.user.name || session.user.email,
        isActive: true,
        lastActivityAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [ticketEditSessions.ticketId, ticketEditSessions.userId],
        set: {
          isActive: true,
          lastActivityAt: new Date(),
        },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error registering presence:', error);
    return NextResponse.json(
      { error: 'Failed to register presence' },
      { status: 500 }
    );
  }
}

// DELETE - Unregister presence
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ticketId = params.id;

    await db
      .update(ticketEditSessions)
      .set({ isActive: false })
      .where(
        and(
          eq(ticketEditSessions.ticketId, ticketId),
          eq(ticketEditSessions.userId, session.user.id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unregistering presence:', error);
    return NextResponse.json(
      { error: 'Failed to unregister presence' },
      { status: 500 }
    );
  }
}
