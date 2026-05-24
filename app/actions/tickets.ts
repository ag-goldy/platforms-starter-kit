"use server";

import { db } from "@/db";
import {
  tickets,
  ticketMessages,
  ticketEvents,
  organizations,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { generateTicketKey } from "@/lib/tickets/keys";

export async function createCustomerTicket(formData: FormData) {
  const session = await requireAuth();

  const subject = formData.get("title") as string;
  const description = formData.get("description") as string;
  const orgId = formData.get("orgId") as string;
  const category = (formData.get("type") as string) || "INCIDENT";
  const priority = (formData.get("priority") as string) || "P3";

  if (!subject || !description || !orgId) {
    throw new Error("Missing required fields");
  }

  const ticketKey = await generateTicketKey(orgId);

  const [newTicket] = await db
    .insert(tickets)
    .values({
      orgId,
      key: ticketKey,
      subject,
      description,
      category: category as "INCIDENT" | "REQUEST" | "PROBLEM" | "CHANGE",
      priority: priority.toUpperCase() as "P1" | "P2" | "P3" | "P4",
      status: "NEW",
      requesterId: session.user.id,
    })
    .returning();

  await db.insert(ticketMessages).values({
    orgId,
    ticketId: newTicket.id,
    authorId: session.user.id,
    authorKind: "user",
    bodyMd: description,
    bodyHtmlSanitized: description,
    visibility: "public",
    channel: "portal",
  });

  await db.insert(ticketEvents).values({
    orgId,
    ticketId: newTicket.id,
    actorId: session.user.id,
    actorKind: "user",
    eventType: "ticket_created",
  });

  await logAudit({
    orgId,
    actorId: session.user.id,
    action: "ticket_created",
    resource: "ticket",
    resourceId: newTicket.id,
  });

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { subdomain: true },
  });
  if (!org) throw new Error("Organization not found");

  revalidatePath(`/${org.subdomain}/tickets`);
  redirect(`/${org.subdomain}/tickets/${encodeURIComponent(newTicket.key)}`);
}

export async function addCustomerComment(formData: FormData) {
  const session = await requireAuth();
  const ticketId = formData.get("ticketId") as string;
  const content = formData.get("content") as string;
  const subdomain = formData.get("subdomain") as string;
  const orgId = formData.get("orgId") as string;

  if (!ticketId || !content || !orgId) {
    throw new Error("Missing required fields");
  }

  await db.transaction(async (tx) => {
    await tx.insert(ticketMessages).values({
      orgId,
      ticketId,
      authorId: session.user.id,
      authorKind: "user",
      bodyMd: content,
      bodyHtmlSanitized: content,
      visibility: "public",
      channel: "portal",
    });

    await tx
      .update(tickets)
      .set({ updatedAt: new Date() })
      .where(eq(tickets.id, ticketId));

    await tx.insert(ticketEvents).values({
      orgId,
      ticketId,
      actorId: session.user.id,
      actorKind: "user",
      eventType: "message_added",
    });
  });

  await logAudit({
    orgId,
    actorId: session.user.id,
    action: "message_added",
    resource: "ticket",
    resourceId: ticketId,
  });

  revalidatePath(`/${subdomain}/tickets/${ticketId}`);
}
