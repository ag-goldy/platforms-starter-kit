import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { tickets, memberships, ticketStatusEnum } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  transitionTicketStatus,
  type TicketStatus,
} from "@/lib/tickets/lifecycle";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, reason } = body;

    if (
      !status ||
      !ticketStatusEnum.enumValues.includes(status as TicketStatus)
    ) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 },
      );
    }
    const targetStatus = status as TicketStatus;

    // Get ticket
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, id),
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    if (!ticket.orgId) {
      return NextResponse.json(
        { error: "Public tickets cannot be updated through this endpoint" },
        { status: 400 },
      );
    }

    // Check membership
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.orgId, ticket.orgId),
        eq(memberships.isActive, true),
      ),
    });

    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const updated = await transitionTicketStatus({
      ticketId: id,
      orgId: ticket.orgId,
      actor: {
        type: session.user.isInternal ? "agent" : "customer",
        userId: session.user.id,
      },
      targetStatus,
      reason: reason || "Status changed via ticket API.",
      source: "api",
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating ticket status:", error);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 },
    );
  }
}
