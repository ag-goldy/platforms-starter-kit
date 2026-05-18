import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { ticketDependencies } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const dependencySchema = z.object({
  dependsOnTicketId: z.string().uuid(),
  dependencyType: z.enum(["blocks", "blocked_by", "relates_to"]),
});

// GET /api/tickets/[id]/dependencies
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

    // Get dependencies where this ticket is the source
    const blocks = await db.query.ticketDependencies.findMany({
      where: and(
        eq(ticketDependencies.ticketId, ticketId),
        eq(ticketDependencies.dependencyType, "blocks"),
      ),
      with: {
        dependsOnTicket: {
          columns: {
            id: true,
            key: true,
            subject: true,
            status: true,
          },
        },
      },
    });

    // Get dependencies where this ticket is blocked by another
    const blockedBy = await db.query.ticketDependencies.findMany({
      where: and(
        eq(ticketDependencies.ticketId, ticketId),
        eq(ticketDependencies.dependencyType, "blocked_by"),
      ),
      with: {
        dependsOnTicket: {
          columns: {
            id: true,
            key: true,
            subject: true,
            status: true,
          },
        },
      },
    });

    // Get related tickets
    const related = await db.query.ticketDependencies.findMany({
      where: and(
        eq(ticketDependencies.ticketId, ticketId),
        eq(ticketDependencies.dependencyType, "relates_to"),
      ),
      with: {
        dependsOnTicket: {
          columns: {
            id: true,
            key: true,
            subject: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ blocks, blockedBy, related });
  } catch (error) {
    console.error("Error fetching dependencies:", error);
    return NextResponse.json(
      { error: "Failed to fetch dependencies" },
      { status: 500 },
    );
  }
}

// POST /api/tickets/[id]/dependencies
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: ticketId } = await params;
    const body = await req.json();

    const parsed = dependencySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { dependsOnTicketId, dependencyType } = parsed.data;

    // Prevent self-dependency
    if (dependsOnTicketId === ticketId) {
      return NextResponse.json(
        { error: "Cannot create dependency on self" },
        { status: 400 },
      );
    }

    // Check if dependency already exists
    const existing = await db.query.ticketDependencies.findFirst({
      where: and(
        eq(ticketDependencies.ticketId, ticketId),
        eq(ticketDependencies.dependsOnTicketId, dependsOnTicketId),
        eq(ticketDependencies.dependencyType, dependencyType),
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: "Dependency already exists" },
        { status: 409 },
      );
    }

    const [dependency] = await db
      .insert(ticketDependencies)
      .values({
        ticketId,
        dependsOnTicketId,
        dependencyType,
        createdById: session.user.id,
      })
      .returning();

    return NextResponse.json({ dependency }, { status: 201 });
  } catch (error) {
    console.error("Error creating dependency:", error);
    return NextResponse.json(
      { error: "Failed to create dependency" },
      { status: 500 },
    );
  }
}

// DELETE /api/tickets/[id]/dependencies
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
    const dependencyId = searchParams.get("dependencyId");

    if (!dependencyId) {
      return NextResponse.json(
        { error: "Dependency ID required" },
        { status: 400 },
      );
    }

    await db
      .delete(ticketDependencies)
      .where(
        and(
          eq(ticketDependencies.id, dependencyId),
          eq(ticketDependencies.ticketId, ticketId),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting dependency:", error);
    return NextResponse.json(
      { error: "Failed to delete dependency" },
      { status: 500 },
    );
  }
}
