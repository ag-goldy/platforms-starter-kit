/**
 * Microsoft Graph Inbound Email (Email-to-Ticket)
 *
 * Subscribes to mailbox notifications and creates tickets from incoming emails.
 * Uses Microsoft Graph Change Notifications (webhooks).
 */

import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { db } from "@/db";
import { tickets, organizations, users, ticketComments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateTicketKey } from "@/lib/tickets/keys";
import { createTicketToken } from "@/lib/tickets/magic-links";
import { getClientIP } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { supportBaseUrl, appBaseUrl } from "@/lib/utils";
import { processEmailReply } from "./reply-handler";
import { getOrgSLATargets } from "@/lib/tickets/sla";
import { sendCustomerTicketCreatedNotification } from "./notifications";
import { renderTicketCreatedEmail } from "./templates/ticket-created";
import { DEFAULT_EMAIL_ORG } from "./templates/defaults";
import { sendWithOutbox } from "./outbox";
import { getTicketById } from "@/lib/tickets/queries";
import {
  claimInboundEmailProcessing,
  recordInboundEmailProcessingResult,
} from "./inbound-idempotency";

// Microsoft Graph Configuration
const TENANT_ID = process.env.MICROSOFT_GRAPH_TENANT_ID;
const CLIENT_ID = process.env.MICROSOFT_GRAPH_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_GRAPH_CLIENT_SECRET;
const FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || "help@agrnetworks.com";

// Subscription configuration
const SUBSCRIPTION_EXPIRATION_DAYS = 3;
const NOTIFICATION_URL = appBaseUrl + "/api/graph/notifications";

interface GraphEmail {
  id: string;
  subject: string;
  from: { emailAddress: { address: string; name?: string } };
  toRecipients: Array<{ emailAddress: { address: string } }>;
  body: { contentType: "text" | "html"; content: string };
  receivedDateTime: string;
  internetMessageId?: string;
  internetMessageHeaders?: Array<{ name: string; value: string }>;
  conversationId?: string;
  isRead: boolean;
}

export function getHeader(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string,
): string | undefined {
  return headers?.find(
    (header) => header.name.toLowerCase() === name.toLowerCase(),
  )?.value;
}

/**
 * Initialize Graph client for inbound operations
 */
function getGraphClient(): Client {
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Microsoft Graph credentials not configured");
  }

  const credential = new ClientSecretCredential(
    TENANT_ID,
    CLIENT_ID,
    CLIENT_SECRET,
  );

  return Client.init({
    authProvider: async (done) => {
      try {
        const token = await credential.getToken(
          "https://graph.microsoft.com/.default",
        );
        done(null, token.token);
      } catch (err) {
        done(err as Error, null);
      }
    },
  });
}

/**
 * Create a subscription to the mailbox for new emails
 */
export async function createEmailSubscription(): Promise<{
  success: boolean;
  subscriptionId?: string;
  error?: string;
}> {
  try {
    const client = getGraphClient();

    const expirationDateTime = new Date();
    expirationDateTime.setDate(
      expirationDateTime.getDate() + SUBSCRIPTION_EXPIRATION_DAYS,
    );

    const clientState = process.env.GRAPH_WEBHOOK_SECRET;
    if (!clientState) {
      return {
        success: false,
        error: "GRAPH_WEBHOOK_SECRET environment variable is not set",
      };
    }

    const subscription = await client.api("/subscriptions").post({
      changeType: "created",
      notificationUrl: NOTIFICATION_URL,
      resource: "/users/" + FROM_EMAIL + "/messages",
      expirationDateTime: expirationDateTime.toISOString(),
      clientState,
    });

    console.log("[Graph Inbound] Subscription created:", subscription.id);

    await storeSubscriptionId(subscription.id, subscription.expirationDateTime);

    return { success: true, subscriptionId: subscription.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Graph Inbound] Failed to create subscription:", message);
    return { success: false, error: message };
  }
}

/**
 * Renew an existing subscription
 */
export async function renewSubscription(subscriptionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const client = getGraphClient();

    const expirationDateTime = new Date();
    expirationDateTime.setDate(
      expirationDateTime.getDate() + SUBSCRIPTION_EXPIRATION_DAYS,
    );

    await client.api("/subscriptions/" + subscriptionId).patch({
      expirationDateTime: expirationDateTime.toISOString(),
    });

    console.log("[Graph Inbound] Subscription renewed:", subscriptionId);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Graph Inbound] Failed to renew subscription:", message);
    return { success: false, error: message };
  }
}

/**
 * Delete a subscription
 */
export async function deleteSubscription(
  subscriptionId: string,
): Promise<void> {
  try {
    const client = getGraphClient();
    await client.api("/subscriptions/" + subscriptionId).delete();
    console.log("[Graph Inbound] Subscription deleted:", subscriptionId);
  } catch (error) {
    console.error("[Graph Inbound] Failed to delete subscription:", error);
  }
}

/**
 * List all active subscriptions
 */
export async function listSubscriptions(): Promise<
  Array<{
    id: string;
    resource: string;
    expirationDateTime: string;
    notificationUrl: string;
  }>
> {
  try {
    const client = getGraphClient();
    const response = await client.api("/subscriptions").get();
    return response.value || [];
  } catch (error) {
    console.error("[Graph Inbound] Failed to list subscriptions:", error);
    return [];
  }
}

/**
 * Fetch a specific email by ID
 */
export async function fetchEmail(
  messageId: string,
): Promise<GraphEmail | null> {
  try {
    const client = getGraphClient();
    const email = await client
      .api("/users/" + FROM_EMAIL + "/messages/" + messageId)
      .select(
        "id,subject,from,toRecipients,body,receivedDateTime,internetMessageId,internetMessageHeaders,conversationId,isRead",
      )
      .get();

    return email;
  } catch (error) {
    console.error("[Graph Inbound] Failed to fetch email:", messageId, error);
    return null;
  }
}

/**
 * Mark an email as read
 */
export async function markEmailAsRead(messageId: string): Promise<void> {
  try {
    const client = getGraphClient();
    await client.api("/users/" + FROM_EMAIL + "/messages/" + messageId).patch({
      isRead: true,
    });
    console.log("[Graph Inbound] Marked email as read:", messageId);
  } catch (error) {
    console.error(
      "[Graph Inbound] Failed to mark email as read:",
      messageId,
      error,
    );
  }
}

/**
 * Process an email and create/update ticket
 */
export async function processInboundEmail(email: GraphEmail): Promise<{
  success: boolean;
  ticketId?: string;
  ticketKey?: string;
  isReply?: boolean;
  error?: string;
}> {
  try {
    if (email.isRead) {
      return { success: true, error: "Email already processed" };
    }

    const idempotencyClaim = await claimInboundEmailProcessing({
      internetMessageId: email.internetMessageId,
      source: "graph",
    });
    if (!idempotencyClaim.claimed) {
      return {
        success: true,
        error: "Inbound email already processed",
      };
    }

    const senderEmail = email.from.emailAddress.address;
    const subject = email.subject || "(No Subject)";

    let textBody = email.body.content;
    if (email.body.contentType === "html") {
      textBody = extractTextFromHtml(email.body.content);
    }

    if (shouldSkipEmail(senderEmail, subject)) {
      console.log(
        "[Graph Inbound] Skipping automated email from:",
        senderEmail,
      );
      await markEmailAsRead(email.id);
      return { success: true, error: "Automated email skipped" };
    }

    const inReplyTo = getHeader(email.internetMessageHeaders, "In-Reply-To");
    const references = getHeader(email.internetMessageHeaders, "References");

    if (!email.internetMessageHeaders?.length) {
      console.warn("[Graph Inbound] No internetMessageHeaders on message", {
        messageId: email.id,
      });
    } else {
      console.log("[Graph Inbound] Parsed internetMessageHeaders", {
        messageId: email.id,
        count: email.internetMessageHeaders.length,
        hasInReplyTo: Boolean(inReplyTo),
        hasReferences: Boolean(references),
      });
    }

    const replyResult = await processEmailReply({
      from: senderEmail,
      subject,
      textBody,
      htmlBody:
        email.body.contentType === "html" ? email.body.content : undefined,
      messageId: email.internetMessageId,
      inReplyTo,
      references,
    });

    if (replyResult && !replyResult.isNewTicket) {
      await markEmailAsRead(email.id);
      await recordInboundEmailProcessingResult({
        internetMessageId: email.internetMessageId,
        ticketId: replyResult.ticket.id,
        orgId: replyResult.ticket.orgId,
      });
      return {
        success: true,
        ticketId: replyResult.ticket.id,
        ticketKey: replyResult.ticket.key,
        isReply: true,
      };
    }

    const org = await findOrganizationForEmail(senderEmail);
    const ticketKey = await generateTicketKey(org?.id ?? null);

    const slaTargets = org
      ? await getOrgSLATargets(org.id, "P3")
      : { responseHours: 4, resolutionHours: 24 };

    const headersList = await headers();
    const ip = getClientIP(headersList) || "unknown";

    const [ticket] = await db
      .insert(tickets)
      .values({
        key: ticketKey,
        orgId: org?.id || null,
        subject: subject.trim(),
        description: textBody.trim(),
        requesterEmail: senderEmail,
        status: "NEW",
        priority: "P3",
        category: "INCIDENT",
        slaResponseTargetHours: slaTargets.responseHours,
        slaResolutionTargetHours: slaTargets.resolutionHours,
      } as typeof tickets.$inferInsert)
      .returning();

    await db.insert(ticketComments).values({
      ticketId: ticket.id,
      content:
        "Ticket created from email sent by " +
        senderEmail +
        " via Microsoft Graph at " +
        new Date().toLocaleString(),
      isInternal: false,
    } as typeof ticketComments.$inferInsert);

    const token = await createTicketToken({
      ticketId: ticket.id,
      email: senderEmail,
      purpose: "VIEW",
      createdIp: ip,
      lastSentAt: new Date(),
    });
    const magicLink = supportBaseUrl + "/ticket/" + token;

    const emailContent = renderTicketCreatedEmail({
      ticket: { key: ticketKey, subject: subject.trim() },
      ticketUrl: magicLink,
      org: org
        ? {
            name: org.branding?.nameOverride || org.name,
            logoUrl: org.branding?.logoUrl,
            supportEmail: org.intakeEmailAddress || DEFAULT_EMAIL_ORG.supportEmail,
            brandColor: org.branding?.primaryColor,
          }
        : DEFAULT_EMAIL_ORG,
    });

    await sendWithOutbox({
      type: "inbound_email_ticket_created",
      to: senderEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      ticketId: ticket.id,
    });

    if (org?.id) {
      const fullTicket = await getTicketById(ticket.id, org.id);
      if (fullTicket && "requester" in fullTicket) {
        await sendCustomerTicketCreatedNotification(
          fullTicket as unknown as Ticket & {
            requester: { email: string; name: string | null } | null;
            organization: { name: string };
          },
        );
      }
    }

    await markEmailAsRead(email.id);
    await recordInboundEmailProcessingResult({
      internetMessageId: email.internetMessageId,
      ticketId: ticket.id,
      orgId: org?.id ?? null,
    });

    console.log(
      "[Graph Inbound] Created ticket:",
      ticketKey,
      "from:",
      senderEmail,
    );

    return {
      success: true,
      ticketId: ticket.id,
      ticketKey,
      isReply: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Graph Inbound] Failed to process email:", message);
    return { success: false, error: message };
  }
}

async function findOrganizationForEmail(senderEmail: string) {
  const domain = senderEmail.split("@")[1]?.toLowerCase();
  if (!domain) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.email, senderEmail),
    with: {
      memberships: {
        with: { organization: true },
      },
    },
  });

  const membership = user?.memberships?.[0];
  if (membership) {
    return membership.organization;
  }

  const allOrgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.allowPublicIntake, true));

  for (const org of allOrgs) {
    if (org.subdomain && domain.startsWith(org.subdomain + ".")) {
      return org;
    }
  }

  return null;
}

function shouldSkipEmail(from: string, subject: string): boolean {
  const skipSenders = [
    "noreply@",
    "no-reply@",
    "daemon@",
    "postmaster@",
    "mailer-daemon@",
    "notifications@",
    "alert@",
    "alerts@",
    "system@",
    "auto@",
    "automated@",
    "bounce@",
    "bounces@",
  ];

  const skipSubjects = [
    "out of office",
    "automatic reply",
    "auto-reply",
    "autoreply",
    "vacation",
    "away from office",
    "delivery status notification",
    "undeliverable",
    "mail delivery failed",
    "message blocked",
    "spam detected",
    "receipt acknowledged",
  ];

  const fromLower = from.toLowerCase();
  const subjectLower = subject.toLowerCase();

  return (
    skipSenders.some((s) => fromLower.includes(s)) ||
    skipSubjects.some((s) => subjectLower.includes(s))
  );
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function storeSubscriptionId(
  subscriptionId: string,
  expirationDateTime: string,
): Promise<void> {
  try {
    const { redis } = await import("@/lib/redis");
    await redis.set("graph:subscription:id", subscriptionId, {
      ex: 60 * 60 * 24 * 30,
    });
    await redis.set("graph:subscription:expires", expirationDateTime, {
      ex: 60 * 60 * 24 * 30,
    });
    console.log("[Graph Inbound] Subscription ID stored for renewal tracking");
  } catch {
    console.log(
      "[Graph Inbound] Subscription ID (store manually for renewal):",
      subscriptionId,
    );
    console.log("[Graph Inbound] Expires at:", expirationDateTime);
  }
}

export async function getStoredSubscriptionId(): Promise<string | null> {
  try {
    const { redis } = await import("@/lib/redis");
    return await redis.get<string>("graph:subscription:id");
  } catch {
    return null;
  }
}

type Ticket = typeof tickets.$inferSelect;
