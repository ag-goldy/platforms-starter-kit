import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and, desc, lt } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// GET /api/notifications - Get user's notifications (cursor-based pagination)
// Query params:
//   cursor   — opaque base64 cursor from previous response's nextCursor
//   limit    — page size, default 20, max 100
//   unread   — 'true' to return only unread
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const rawLimit = parseInt(
      searchParams.get("limit") || String(DEFAULT_PAGE_SIZE),
      10,
    );
    // Enforce default and maximum page size
    const limit = Math.min(
      isNaN(rawLimit) || rawLimit < 1 ? DEFAULT_PAGE_SIZE : rawLimit,
      MAX_PAGE_SIZE,
    );

    // Decode cursor: base64-encoded ISO timestamp of the last seen createdAt
    const cursorParam = searchParams.get("cursor");
    let cursorDate: Date | null = null;
    if (cursorParam) {
      try {
        cursorDate = new Date(
          Buffer.from(cursorParam, "base64").toString("utf8"),
        );
        if (isNaN(cursorDate.getTime())) cursorDate = null;
      } catch {
        cursorDate = null;
      }
    }

    // Build where clause: user filter + optional unread filter + optional cursor
    const baseConditions = [eq(notifications.userId, session.user.id)];
    if (unreadOnly) baseConditions.push(eq(notifications.read, false));
    if (cursorDate)
      baseConditions.push(lt(notifications.createdAt, cursorDate));
    const whereClause = and(...baseConditions);

    // Fetch one extra to determine if there's a next page
    const [userNotifications, unreadResult] = await Promise.all([
      db.query.notifications.findMany({
        where: whereClause,
        orderBy: [desc(notifications.createdAt)],
        limit: limit + 1,
      }),
      db.$count(
        notifications,
        and(
          eq(notifications.userId, session.user.id),
          eq(notifications.read, false),
        ),
      ),
    ]);

    const hasMore = userNotifications.length > limit;
    const page = hasMore
      ? userNotifications.slice(0, limit)
      : userNotifications;

    // nextCursor = base64-encoded createdAt of the last item in current page
    const nextCursor = hasMore
      ? Buffer.from(page[page.length - 1].createdAt.toISOString()).toString(
          "base64",
        )
      : null;

    return NextResponse.json({
      notifications: page,
      unreadCount: unreadResult,
      hasMore,
      nextCursor,
    });
  } catch (error) {
    console.error("[Notifications API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/notifications/mark-read - Mark notifications as read
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 30 mark-read actions per hour per user
    const rl = await rateLimit(`notifications:post:${session.user.id}`, {
      maxRequests: 30,
      windowSeconds: 3600,
    });
    if (!rl.allowed)
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 },
      );

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
            eq(notifications.read, false),
          ),
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
            eq(notifications.userId, session.user.id),
          ),
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Notifications API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/notifications - Delete old notifications
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const daysOld = parseInt(searchParams.get("days") || "30");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.userId, session.user.id),
          eq(notifications.read, true),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Notifications API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
