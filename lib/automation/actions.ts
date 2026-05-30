/**
 * Action execution logic for automation rules
 */

import { db } from "@/db";
import {
  memberships,
  ticketComments,
  ticketTagAssignments,
  ticketTags,
  ticketWatchers,
  tickets,
  users,
  ticketCategoryEnum,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { Action } from "./types";
import type { TicketPriority, TicketStatus } from "@/lib/tickets/queries";
import { sendWithOutbox } from "@/lib/email/outbox";
import { createNotification } from "@/lib/notifications/service";
import { publishRealtimeEvent } from "@/lib/realtime/broadcast";
import { getAIResponse } from "@/lib/ai/client";

type TicketCategory = (typeof ticketCategoryEnum.enumValues)[number];

export interface ActionContext {
  ticketId: string;
  orgId: string;
  userId?: string;
}

/**
 * Execute a single action
 */
export async function executeAction(
  action: Action,
  context: ActionContext,
): Promise<void> {
  const { type, value } = action;
  const { ticketId, orgId } = context;

  switch (type) {
    case "set_status":
      if (typeof value === "string") {
        await db
          .update(tickets)
          .set({ status: value as TicketStatus, updatedAt: new Date() })
          .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)));
      }
      break;

    case "set_priority":
      if (typeof value === "string") {
        await db
          .update(tickets)
          .set({ priority: value as TicketPriority, updatedAt: new Date() })
          .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)));
      }
      break;

    case "set_category":
      if (typeof value === "string") {
        await db
          .update(tickets)
          .set({ category: value as TicketCategory, updatedAt: new Date() })
          .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)));
      }
      break;

    case "set_assignee":
    case "assign_to":
      if (typeof value === "string") {
        await db
          .update(tickets)
          .set({ assigneeId: value, updatedAt: new Date() })
          .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)));
      }
      break;

    case "assign_to_round_robin":
      await assignRoundRobin(ticketId, orgId);
      break;

    case "add_tag":
      if (typeof value === "string") {
        await addTag(ticketId, value);
      }
      break;

    case "add_tags":
      if (Array.isArray(value)) {
        for (const tag of value) await addTag(ticketId, tag);
      }
      break;

    case "remove_tag":
      if (typeof value === "string") {
        await removeTag(ticketId, value);
      }
      break;

    case "remove_tags":
      if (Array.isArray(value)) {
        for (const tag of value) await removeTag(ticketId, tag);
      }
      break;

    case "add_message":
      await addAutomationMessage(action, context);
      break;

    case "send_email":
      await sendAutomationEmail(action, context);
      break;

    case "trigger_webhook":
      await triggerWebhook(action, context);
      break;

    case "add_watchers":
      await addWatchers(ticketId, value);
      break;

    case "run_ai":
      await runAIAction(action, context);
      break;

    case "notify_assignee":
      await notifyAssignee(context);
      break;

    case "notify_team":
      await notifyTeam(context);
      break;

    default:
      console.warn(`Unknown action type: ${type}`);
  }
}

/**
 * Execute all actions
 */
export async function executeActions(
  actions: Action[],
  context: ActionContext,
): Promise<{ executed: number; errors: string[] }> {
  let executed = 0;
  const errors: string[] = [];

  for (const action of actions) {
    try {
      await executeAction(action, context);
      executed++;
    } catch (error) {
      console.error(`Failed to execute action ${action.type}:`, error);
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return { executed, errors };
}

/**
 * Assign ticket using round-robin algorithm
 */
async function assignRoundRobin(
  ticketId: string,
  orgId: string,
): Promise<void> {
  const allUsers = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .where(
      and(
        eq(memberships.orgId, orgId),
        eq(memberships.isActive, true),
        eq(users.isInternal, true),
      ),
    );

  if (allUsers.length === 0) {
    return; // No users to assign to
  }

  // Simple round-robin: Get ticket count per user and assign to user with least tickets
  // This is a simplified version - in production, you'd want more sophisticated logic
  const ticketCounts = await Promise.all(
    allUsers.map(async (user) => {
      const count = await db.query.tickets.findMany({
        where: and(eq(tickets.orgId, orgId), eq(tickets.assigneeId, user.id)),
      });
      return { userId: user.id, count: count.length };
    }),
  );

  // Find user with least tickets
  const userWithLeastTickets = ticketCounts.reduce((min, current) =>
    current.count < min.count ? current : min,
  );

  await db
    .update(tickets)
    .set({ assigneeId: userWithLeastTickets.userId, updatedAt: new Date() })
    .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)));
}

/**
 * Add a tag to a ticket
 */
async function addTag(ticketId: string, tagName: string): Promise<void> {
  // Find or create tag
  const existingTags = await db
    .select()
    .from(ticketTags)
    .where(eq(ticketTags.name, tagName))
    .limit(1);

  let tag = existingTags[0];

  if (!tag) {
    const [newTag] = await db
      .insert(ticketTags)
      .values({ name: tagName })
      .returning();
    tag = newTag;
  }

  // Check if assignment already exists
  const existingAssignments = await db
    .select()
    .from(ticketTagAssignments)
    .where(
      and(
        eq(ticketTagAssignments.ticketId, ticketId),
        eq(ticketTagAssignments.tagId, tag.id),
      ),
    )
    .limit(1);

  if (existingAssignments.length === 0) {
    await db.insert(ticketTagAssignments).values({
      ticketId,
      tagId: tag.id,
    });
  }
}

/**
 * Remove a tag from a ticket
 */
async function removeTag(ticketId: string, tagName: string): Promise<void> {
  const tags = await db
    .select()
    .from(ticketTags)
    .where(eq(ticketTags.name, tagName))
    .limit(1);

  const tag = tags[0];

  if (tag) {
    await db
      .delete(ticketTagAssignments)
      .where(
        and(
          eq(ticketTagAssignments.ticketId, ticketId),
          eq(ticketTagAssignments.tagId, tag.id),
        ),
      );
  }
}

async function addAutomationMessage(
  action: Action,
  context: ActionContext,
): Promise<void> {
  const content =
    typeof action.value === "string"
      ? action.value
      : action.template || "Automation rule applied.";

  const [comment] = await db
    .insert(ticketComments)
    .values({
      ticketId: context.ticketId,
      userId: context.userId,
      content,
      isInternal: action.visibility !== "public",
    })
    .returning();

  await publishRealtimeEvent({
    orgId: context.orgId,
    channel: "tickets",
    event: "ticket.automation_message",
    data: {
      ticketId: context.ticketId,
      commentId: comment.id,
      isInternal: comment.isInternal,
    },
  }).catch((error) => {
    console.error(
      "[Automation] Failed to broadcast automation message:",
      error,
    );
  });
}

async function sendAutomationEmail(
  action: Action,
  context: ActionContext,
): Promise<void> {
  const to = typeof action.value === "string" ? action.value : null;
  if (!to) return;

  const ticket = await db.query.tickets.findFirst({
    where: and(
      eq(tickets.id, context.ticketId),
      eq(tickets.orgId, context.orgId),
    ),
    columns: { key: true, subject: true },
  });

  const subject =
    action.subject || `Automation notice for ${ticket?.key || "ticket"}`;
  const text =
    action.template ||
    `Automation rule applied to ${ticket?.subject || context.ticketId}.`;

  await sendWithOutbox({
    type: "automation_action",
    to,
    subject,
    html: `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`,
    text,
    ticketId: context.ticketId,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeWebhookUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (!["https:", "http:"].includes(url.protocol)) return false;
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      hostname === "metadata.google.internal" ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function triggerWebhook(
  action: Action,
  context: ActionContext,
): Promise<void> {
  const url =
    action.url || (typeof action.value === "string" ? action.value : null);
  if (!url || !isSafeWebhookUrl(url)) {
    throw new Error("Unsafe or invalid webhook URL");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event: "automation.action",
      ticketId: context.ticketId,
      orgId: context.orgId,
      data: action.data || {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}`);
  }
}

async function addWatchers(
  ticketId: string,
  value: Action["value"],
): Promise<void> {
  const userIds = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];
  for (const userId of userIds) {
    await db
      .insert(ticketWatchers)
      .values({ ticketId, userId })
      .onConflictDoNothing();
  }
}

async function runAIAction(
  action: Action,
  context: ActionContext,
): Promise<void> {
  const ticket = await db.query.tickets.findFirst({
    where: and(
      eq(tickets.id, context.ticketId),
      eq(tickets.orgId, context.orgId),
    ),
    with: {
      comments: {
        orderBy: (comments, { asc }) => [asc(comments.createdAt)],
      },
    },
  });
  if (!ticket) return;

  const transcript = ticket.comments
    .map(
      (comment) =>
        `${comment.isInternal ? "[Internal] " : ""}${comment.content}`,
    )
    .join("\n\n");
  const mode = action.mode || "summarize";
  const prompt =
    mode === "suggest_reply"
      ? "Draft a concise support reply for this ticket. Do not invent facts."
      : mode === "categorize"
        ? "Suggest the best ticket category and priority. Return concise reasoning."
        : "Summarize this ticket in three concise sentences.";

  const completion = await getAIResponse(
    [
      {
        role: "system",
        content:
          "You are an automation assistant for an IT helpdesk. Keep outputs concise and operational.",
      },
      {
        role: "user",
        content: `${prompt}\n\nSubject: ${ticket.subject}\nDescription: ${ticket.description}\n\nThread:\n${transcript}`,
      },
    ],
    { temperature: 0.2, max_tokens: 300 },
  );

  const result = completion.choices[0]?.message?.content?.trim();
  if (!result) return;

  await db.insert(ticketComments).values({
    ticketId: context.ticketId,
    userId: context.userId,
    content: `Automation AI ${mode.replace("_", " ")}:\n\n${result}`,
    isInternal: true,
  });
}

async function notifyAssignee(context: ActionContext): Promise<void> {
  const ticket = await db.query.tickets.findFirst({
    where: and(
      eq(tickets.id, context.ticketId),
      eq(tickets.orgId, context.orgId),
    ),
    columns: { id: true, key: true, subject: true, assigneeId: true },
  });
  if (!ticket?.assigneeId) return;

  await createNotification({
    userId: ticket.assigneeId,
    type: "AUTOMATION_TRIGGERED",
    title: `Automation ran on ${ticket.key}`,
    message: ticket.subject,
    data: { ticketId: ticket.id, ticketKey: ticket.key, orgId: context.orgId },
    link: `/app/tickets/${ticket.id}`,
  });
}

async function notifyTeam(context: ActionContext): Promise<void> {
  const ticket = await db.query.tickets.findFirst({
    where: and(
      eq(tickets.id, context.ticketId),
      eq(tickets.orgId, context.orgId),
    ),
    columns: { id: true, key: true, subject: true },
  });
  if (!ticket) return;

  const team = await db
    .select({ userId: users.id })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .where(
      and(
        eq(memberships.orgId, context.orgId),
        eq(memberships.isActive, true),
        eq(users.isInternal, true),
      ),
    );

  await Promise.all(
    team.map((member) =>
      createNotification({
        userId: member.userId,
        type: "AUTOMATION_TRIGGERED",
        title: `Automation ran on ${ticket.key}`,
        message: ticket.subject,
        data: {
          ticketId: ticket.id,
          ticketKey: ticket.key,
          orgId: context.orgId,
        },
        link: `/app/tickets/${ticket.id}`,
      }),
    ),
  );
}
