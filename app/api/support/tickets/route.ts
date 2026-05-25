import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v3";
import { db } from "@/db";
import { tickets, ticketComments, organizations } from "@/db/schema";
import { generateTicketKey } from "@/lib/tickets/keys";
import { sendWithOutbox } from "@/lib/email/outbox";
import { renderTicketCreatedEmail } from "@/lib/email/templates/ticket-created";
import { DEFAULT_EMAIL_ORG } from "@/lib/email/templates/defaults";
import { eq } from "drizzle-orm";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { supportBaseUrl } from "@/lib/utils";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

const createTicketSchema = z.object({
  email: z.string().email("Invalid email address").max(254),
  name: z.string().max(100).optional(),
  subject: z.string().min(1, "Subject is required").max(200),
  description: z.string().min(1, "Description is required").max(10000),
  orgId: z.string().uuid("Invalid organization ID").optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP (10 tickets per hour per IP)
    const headersList = await headers();
    const ip = getClientIP(headersList) ?? "unknown";
    const rateLimitResult = await rateLimit({
      identifier: `support:tickets:${ip}`,
      limit: 10,
      windowSeconds: 60 * 60,
    });
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = createTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { email, name, subject, description, orgId } = parsed.data;

    let resolvedOrgId: string | null = null;

    if (orgId) {
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
      });

      if (org) {
        resolvedOrgId = org.id;
      }
    }

    const ticketKey = await generateTicketKey(resolvedOrgId);

    const [ticket] = await db
      .insert(tickets)
      .values({
        key: ticketKey,
        orgId: resolvedOrgId,
        subject,
        description,
        status: "NEW",
        priority: "P3",
        category: "SERVICE_REQUEST",
        requesterEmail: email,
      })
      .returning();

    const createdDate = new Date().toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    await db.insert(ticketComments).values({
      ticketId: ticket.id,
      content: `Ticket created on ${createdDate}. Submitted by: ${email}${name ? ` (${name})` : ""}`,
      isInternal: false,
    });

    const { createTicketToken } = await import("@/lib/tickets/magic-links");
    const token = await createTicketToken({
      ticketId: ticket.id,
      email,
      purpose: "VIEW",
      expiresInDays: 30,
    });

    const ticketUrl = `${supportBaseUrl}/ticket/${token}`;

    try {
      const emailContent = renderTicketCreatedEmail({
        ticket: { key: ticketKey, subject },
        ticketUrl,
        requester: { name },
        org: DEFAULT_EMAIL_ORG,
      });

      await sendWithOutbox({
        type: "ticket_created",
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    } catch (emailError) {
      console.error("[Support Ticket] Email failed:", emailError);
    }

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        key: ticketKey,
        subject: ticket.subject,
        status: ticket.status,
      },
      ticketUrl,
    });
  } catch (error) {
    console.error("[Support Ticket] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create ticket", details: errorMessage },
      { status: 500 },
    );
  }
}
