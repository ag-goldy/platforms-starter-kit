import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// GET /api/notifications - Get user's notifications
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const whereClause = unreadOnly
      ? and(eq(notifications.userId, session.user.id), eq(notifications.read, false))
      : eq(notifications.userId, session.user.id);

    const [userNotifications, totalResult, unreadResult] = await Promise.all([
      db.query.notifications.findMany({
        where: whereClause,
        orderBy: [desc(notifications.createdAt)],
        limit,
        offset,
      }),
      db.$count(notifications, eq(notifications.userId, session.user.id)),
      db.$count(
        notifications,
        and(eq(notifications.userId, session.user.id), eq(notifications.read, false))
      ),
    ]);

    return NextResponse.json({
      notifications: userNotifications,
      total: totalResult,
      unreadCount: unreadResult,
    });
  } catch (error) {
    console.error('[Notifications API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/notifications/mark-read - Mark notifications as read
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, markAll = false } = body;

    if (markAll) {
      // Mark all as read
      await db
        .update(notifications)
        .set({
          read: true,
          readAt: new Date(),
        })
        .where(
          and(
            eq(notifications.userId, session.user.id),
            eq(notifications.read, false)
          )
        );
    } else if (notificationId) {
      // Mark single as read
      await db
        .update(notifications)
        .set({
          read: true,
          readAt: new Date(),
        })
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, session.user.id)
          )
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Notifications API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications - Delete old notifications
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const daysOld = parseInt(searchParams.get('days') || '30');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.userId, session.user.id),
          eq(notifications.read, true)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Notifications API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
