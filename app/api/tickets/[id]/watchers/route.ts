import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { ticketWatchers, users, platformAdmins } from "@/db/schema";
import { canViewTicket, AuthorizationError } from "@/lib/auth/permissions";
import { eq, and, isNull, isNotNull } from "drizzle-orm";

// GET /api/tickets/[id]/watchers - Get all watchers for a ticket
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if user can view the ticket
    await canViewTicket(id);

    // Get regular user watchers
    const userWatchers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: ticketWatchers.createdAt,
      })
      .from(ticketWatchers)
      .innerJoin(users, eq(ticketWatchers.userId, users.id))
      .where(
        and(eq(ticketWatchers.ticketId, id), isNotNull(ticketWatchers.userId)),
      );

    // Get platform admin watchers
    const adminWatchers = await db
      .select({
        id: platformAdmins.id,
        name: platformAdmins.name,
        email: platformAdmins.email,
        createdAt: ticketWatchers.createdAt,
      })
      .from(ticketWatchers)
      .innerJoin(
        platformAdmins,
        eq(ticketWatchers.platformAdminId, platformAdmins.id),
      )
      .where(
        and(
          eq(ticketWatchers.ticketId, id),
          isNotNull(ticketWatchers.platformAdminId),
        ),
      );

    return NextResponse.json({ watchers: [...userWatchers, ...adminWatchers] });
  } catch (error) {
    console.error("[Watchers API] Error fetching watchers:", error);
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch watchers" },
      { status: 500 },
    );
  }
}

// POST /api/tickets/[id]/watchers - Toggle current user as watcher
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;
    const isPlatformAdmin = session.user.isPlatformAdmin;

    // Check if user can view the ticket
    await canViewTicket(id);

    // Check if user is already watching (handle both regular users and platform admins)
    const existingWatcher = isPlatformAdmin
      ? await db.query.ticketWatchers.findFirst({
          where: and(
            eq(ticketWatchers.ticketId, id),
            eq(ticketWatchers.platformAdminId, userId),
          ),
        })
      : await db.query.ticketWatchers.findFirst({
          where: and(
            eq(ticketWatchers.ticketId, id),
            eq(ticketWatchers.userId, userId),
          ),
        });

    if (existingWatcher) {
      // Remove watcher
      if (isPlatformAdmin) {
        await db
          .delete(ticketWatchers)
          .where(
            and(
              eq(ticketWatchers.ticketId, id),
              eq(ticketWatchers.platformAdminId, userId),
            ),
          );
      } else {
        await db
          .delete(ticketWatchers)
          .where(
            and(
              eq(ticketWatchers.ticketId, id),
              eq(ticketWatchers.userId, userId),
            ),
          );
      }

      return NextResponse.json({ watching: false });
    } else {
      // Add watcher
      if (isPlatformAdmin) {
        await db.insert(ticketWatchers).values({
          ticketId: id,
          platformAdminId: userId,
        });
      } else {
        await db.insert(ticketWatchers).values({
          ticketId: id,
          userId: userId,
        });
      }

      return NextResponse.json({ watching: true });
    }
  } catch (error) {
    console.error("[Watchers API] Error toggling watcher:", error);
    return NextResponse.json(
      { error: "Failed to update watcher status" },
      { status: 500 },
    );
  }
}
