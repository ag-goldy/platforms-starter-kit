"use server";

import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { attachments, ticketComments, tickets, users } from "@/db/schema";
import {
  requireTicketAccess,
  requireAuth,
  requireInternalRole,
} from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { assertTicketMutable } from "@/lib/tickets/lifecycle";
import { generateTicketKey } from "@/lib/tickets/keys";
import { getOrgSLATargets } from "@/lib/tickets/sla";

type TicketStatus = typeof tickets.$inferSelect.status;
type TicketPriority = typeof tickets.$inferSelect.priority;
type TicketCategory = typeof tickets.$inferSelect.category;
type EditableTicket = Awaited<ReturnType<typeof requireTicketAccess>> & {
  orgId: string | null;
};

type CreateTicketInput = {
  orgId: string | null;
  subject: string;
  description: string;
  priority: string;
  category: string;
  assigneeId?: string | null;
  requesterEmail?: string | null;
  siteId?: string | null;
  areaId?: string | null;
};

function normalizeStatus(status: string): TicketStatus {
  const normalized = status.toUpperCase() as TicketStatus;
  const aliases: Record<string, TicketStatus> = {
    PENDING: "WAITING_ON_CUSTOMER",
    ON_HOLD: "WAITING_ON_CUSTOMER",
  };

  return aliases[normalized] ?? normalized;
}

function normalizePriority(priority: string): TicketPriority {
  return priority.toUpperCase() as TicketPriority;
}

function normalizeCategory(category: string): TicketCategory {
  return category.toUpperCase() as TicketCategory;
}

function revalidateTicket(ticketId: string) {
  revalidatePath("/app");
  revalidatePath("/app/tickets");
  revalidatePath(`/app/tickets/${ticketId}`);
}

async function getEditableTicket(
  ticketId: string,
  orgId?: string,
): Promise<EditableTicket> {
  const ticket = await requireTicketAccess(ticketId);

  if (!ticket) {
    throw new Error("Ticket not found");
  }
  if (orgId && ticket.orgId !== orgId) {
    throw new Error("Ticket organization mismatch");
  }

  assertTicketMutable(ticket);
  return ticket as EditableTicket;
}

function ticketIdentityWhere(ticketId: string, orgId: string | null) {
  return orgId
    ? and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId))
    : and(eq(tickets.id, ticketId), isNull(tickets.orgId));
}

async function writeTicketAudit(input: {
  orgId?: string | null;
  ticketId: string;
  actorId: string;
  actorKind: "user" | "platform_admin";
  action: string;
  details?: Record<string, unknown>;
}) {
  await logAudit({
    orgId: input.orgId ?? undefined,
    actorId: input.actorId,
    actorKind: input.actorKind,
    action: input.action,
    resource: "ticket",
    resourceId: input.ticketId,
    details: input.details,
  });
}

export async function updateTicketStatus(
  ticketId: string,
  orgId: string,
  status: string,
) {
  await updateTicketStatusAction(ticketId, status, orgId);
}

export async function updateTicketPriority(
  ticketId: string,
  orgId: string,
  priority: string,
) {
  await updateTicketPriorityAction(ticketId, priority, orgId);
}

export async function assignTicket(
  ticketId: string,
  orgId: string,
  assigneeId: string | null,
) {
  await assignTicketAction(ticketId, assigneeId, orgId);
}

export async function addAgentMessage(
  ticketId: string,
  orgId: string,
  content: string,
  isInternal: boolean,
) {
  await addTicketCommentAction(ticketId, content, isInternal, orgId);
}

export async function createTicketAction(input: CreateTicketInput): Promise<{
  success: boolean;
  ticketId?: string;
  error?: string;
}> {
  const session = await requireInternalRole();
  const subject = input.subject.trim();
  const description = input.description.trim();

  if (!subject || !description) {
    return {
      success: false,
      error: "Subject and description are required.",
    };
  }

  try {
    const key = await generateTicketKey(input.orgId);
    const priority = normalizePriority(input.priority || "P3");
    const category = normalizeCategory(input.category || "INCIDENT");
    const slaTargets = await getOrgSLATargets(input.orgId, priority);

    const [ticket] = await db
      .insert(tickets)
      .values({
        key,
        orgId: input.orgId,
        subject,
        description,
        status: "NEW",
        priority,
        category,
        assigneeId: input.assigneeId || null,
        requesterEmail: input.requesterEmail || null,
        siteId: input.siteId || null,
        areaId: input.areaId || null,
        slaResponseTargetHours: slaTargets.responseHours,
        slaResolutionTargetHours: slaTargets.resolutionHours,
      })
      .returning();

    await writeTicketAudit({
      orgId: input.orgId,
      ticketId: ticket.id,
      actorId: session.user.id,
      actorKind: session.platformAdmin ? "platform_admin" : "user",
      action: "ticket.created",
      details: { key, source: "staff" },
    });

    revalidatePath("/app");
    revalidatePath("/app/tickets");
    if (input.orgId) {
      revalidatePath(`/app/organizations/${input.orgId}`);
    }
    return { success: true, ticketId: ticket.id };
  } catch (error) {
    console.error(
      "[Tickets] Failed to create ticket:",
      error instanceof Error ? error.message : "unknown error",
    );
    return { success: false, error: "Failed to create ticket." };
  }
}

export async function updateTicketStatusAction(
  ticketId: string,
  status: string,
  orgId?: string,
) {
  const session = await requireInternalRole();
  const ticket = await getEditableTicket(ticketId, orgId);
  const targetStatus = normalizeStatus(status);
  const actorIsPlatformAdmin = Boolean(session.platformAdmin);

  await db
    .update(tickets)
    .set({
      status: targetStatus,
      resolvedAt: targetStatus === "RESOLVED" ? new Date() : ticket.resolvedAt,
      updatedAt: new Date(),
    })
    .where(ticketIdentityWhere(ticketId, ticket.orgId));

  await writeTicketAudit({
    orgId: ticket.orgId,
    ticketId,
    actorId: session.user.id,
    actorKind: actorIsPlatformAdmin ? "platform_admin" : "user",
    action: "ticket.status_changed",
    details: { status: targetStatus },
  });

  revalidateTicket(ticketId);
  return { success: true };
}

export async function updateTicketPriorityAction(
  ticketId: string,
  priority: string,
  orgId?: string,
) {
  const session = await requireInternalRole();
  const ticket = await getEditableTicket(ticketId, orgId);
  const targetPriority = normalizePriority(priority);
  const actorIsPlatformAdmin = Boolean(session.platformAdmin);

  await db
    .update(tickets)
    .set({ priority: targetPriority, updatedAt: new Date() })
    .where(ticketIdentityWhere(ticketId, ticket.orgId));

  await writeTicketAudit({
    orgId: ticket.orgId,
    ticketId,
    actorId: session.user.id,
    actorKind: actorIsPlatformAdmin ? "platform_admin" : "user",
    action: "ticket.priority_changed",
    details: { priority: targetPriority },
  });

  revalidateTicket(ticketId);
  return { success: true };
}

export async function assignTicketAction(
  ticketId: string,
  assigneeId: string | null,
  orgId?: string,
) {
  const session = await requireInternalRole();
  const ticket = await getEditableTicket(ticketId, orgId);
  const actorIsPlatformAdmin = Boolean(session.platformAdmin);

  if (assigneeId) {
    const assignee = await db.query.users.findFirst({
      where: eq(users.id, assigneeId),
      columns: { id: true },
    });

    if (!assignee) {
      throw new Error("Assignee must be an internal user account");
    }
  }

  await db
    .update(tickets)
    .set({ assigneeId, updatedAt: new Date() })
    .where(ticketIdentityWhere(ticketId, ticket.orgId));

  await writeTicketAudit({
    orgId: ticket.orgId,
    ticketId,
    actorId: session.user.id,
    actorKind: actorIsPlatformAdmin ? "platform_admin" : "user",
    action: "ticket.assignee_changed",
    details: { assigneeId },
  });

  revalidateTicket(ticketId);
  return { success: true };
}

export async function addTicketCommentAction(
  ticketId: string,
  content: string,
  isInternal = false,
  orgId?: string,
) {
  const session = await requireAuth();
  const ticket = await getEditableTicket(ticketId, orgId);
  const trimmed = content.trim();

  if (!trimmed) {
    throw new Error("Comment cannot be empty");
  }

  const actorIsPlatformAdmin = Boolean(session.isPlatformAdmin);

  await db.transaction(async (tx) => {
    await tx.insert(ticketComments).values({
      ticketId,
      userId: actorIsPlatformAdmin ? null : session.user.id,
      platformAdminId: actorIsPlatformAdmin ? session.user.id : null,
      authorEmail: session.user.email,
      content: trimmed,
      isInternal,
    });

    await tx
      .update(tickets)
      .set({ updatedAt: new Date() })
      .where(ticketIdentityWhere(ticketId, ticket.orgId));
  });

  await writeTicketAudit({
    orgId: ticket.orgId,
    ticketId,
    actorId: session.user.id,
    actorKind: actorIsPlatformAdmin ? "platform_admin" : "user",
    action: "ticket.comment_added",
    details: { isInternal },
  });

  revalidateTicket(ticketId);
  return { success: true };
}

export async function addTicketAttachmentAction(formData: FormData) {
  const session = await requireAuth();
  const ticketId = String(formData.get("ticketId") || "");
  const files = formData
    .getAll("attachments")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (!ticketId) {
    throw new Error("Missing ticket id");
  }
  if (files.length === 0) {
    throw new Error("Please choose a file to upload");
  }

  const ticket = await getEditableTicket(ticketId);
  const actorIsPlatformAdmin = Boolean(session.isPlatformAdmin);

  for (const file of files) {
    const storageKey = `tickets/${ticketId}/${randomUUID()}-${file.name}`;
    const blob = await put(storageKey, file, {
      access: "private",
      addRandomSuffix: false,
    });

    await db.insert(attachments).values({
      ticketId,
      orgId: ticket.orgId,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
      blobPathname: blob.pathname,
      storageKey: blob.pathname,
      uploadedBy: actorIsPlatformAdmin ? null : session.user.id,
      uploadedByPlatformAdmin: actorIsPlatformAdmin ? session.user.id : null,
      scanStatus: "PENDING",
    });
  }

  await writeTicketAudit({
    orgId: ticket.orgId,
    ticketId,
    actorId: session.user.id,
    actorKind: actorIsPlatformAdmin ? "platform_admin" : "user",
    action: "ticket.attachment_added",
    details: { count: files.length },
  });

  revalidateTicket(ticketId);
  return { success: true };
}
