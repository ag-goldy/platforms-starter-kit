import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { timeEntries } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v3";
import { rateLimit } from "@/lib/rate-limit";

const createTimeEntrySchema = z.object({
  durationMinutes: z.number().min(1),
  description: z.string().optional(),
  isBillable: z.boolean().default(true),
  hourlyRate: z.number().optional(),
});

// GET /api/tickets/[id]/time-entries
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: ticketId } = await params;

    const entries = await db.query.timeEntries.findMany({
      where: eq(timeEntries.ticketId, ticketId),
      orderBy: (entries, { desc }) => [desc(entries.startedAt)],
      with: {
        user: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Error fetching time entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch time entries" },
      { status: 500 },
    );
  }
}

// POST /api/tickets/[id]/time-entries
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 30 time entries per hour per user
    const rl = await rateLimit(`time-entries:post:${session.user.id}`, {
      maxRequests: 30,
      windowSeconds: 3600,
    });
    if (!rl.allowed)
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 },
      );

    const { id: ticketId } = await params;
    const body = await req.json();

    const parsed = createTimeEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { durationMinutes, description, isBillable, hourlyRate } =
      parsed.data;

    // Calculate start and end times
    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - durationMinutes * 60 * 1000);

    const [entry] = await db
      .insert(timeEntries)
      .values({
        ticketId,
        userId: session.user.id,
        startedAt,
        endedAt,
        durationMinutes,
        description: description || null,
        isBillable,
        hourlyRate: hourlyRate || null,
      })
      .returning();

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Error creating time entry:", error);
    return NextResponse.json(
      { error: "Failed to create time entry" },
      { status: 500 },
    );
  }
}

// DELETE /api/tickets/[id]/time-entries
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: ticketId } = await params;
    const { searchParams } = new URL(req.url);
    const entryId = searchParams.get("entryId");

    if (!entryId) {
      return NextResponse.json({ error: "Entry ID required" }, { status: 400 });
    }

    // Only allow users to delete their own entries (or admins)
    await db
      .delete(timeEntries)
      .where(
        and(
          eq(timeEntries.id, entryId),
          eq(timeEntries.ticketId, ticketId),
          eq(timeEntries.userId, session.user.id),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting time entry:", error);
    return NextResponse.json(
      { error: "Failed to delete time entry" },
      { status: 500 },
    );
  }
}
