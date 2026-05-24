import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { csatResponses, tickets } from "@/db/schema";
import { eq, and, avg } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { requireOrgRole } from "@/lib/auth/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createHash } from "crypto";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tickets/[id]/csat
 * Get CSAT response for this ticket
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const resolvedParams = await params;
    const ticketId = resolvedParams.id;

    const [ticket] = await db
      .select({ orgId: tickets.orgId })
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    await requireOrgRole(ticket.orgId!, [
      "ADMIN",
      "AGENT",
      "CUSTOMER_ADMIN",
      "REQUESTER",
      "VIEWER",
    ]);

    const response = await db
      .select()
      .from(csatResponses)
      .where(eq(csatResponses.ticketId, ticketId))
      .limit(1);

    return NextResponse.json({ rating: response[0] || null });
  } catch (error) {
    console.error("[API] Failed to fetch CSAT:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch CSAT",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/tickets/[id]/csat
 * Submit CSAT rating
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const resolvedParams = await params;
    const ticketId = resolvedParams.id;

    // 5 CSAT submissions per hour per user (keyed by userId hash to avoid leaking IDs in Redis)
    const rateLimitKey = `csat:post:${createHash("sha256").update(user!.id).digest("hex").slice(0, 16)}`;
    const rl = await rateLimit(rateLimitKey, {
      maxRequests: 5,
      windowSeconds: 3600,
    });
    if (!rl.allowed)
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 },
      );

    const [ticket] = await db
      .select({
        orgId: tickets.orgId,
        status: tickets.status,
        requesterId: tickets.requesterId,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Only allow rating if ticket is resolved or closed
    if (ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") {
      return NextResponse.json(
        { error: "Can only rate resolved or closed tickets" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { rating, comment } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 },
      );
    }

    try {
      const [response] = await db
        .insert(csatResponses)
        .values({
          ticketId,
          orgId: ticket.orgId!,
          userId: user.id,
          rating,
          comment: comment || null,
        })
        .returning();

      return NextResponse.json({ response }, { status: 201 });
    } catch (error: any) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "You have already rated this ticket" },
          { status: 400 },
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("[API] Failed to submit CSAT:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to submit CSAT",
      },
      { status: 500 },
    );
  }
}


