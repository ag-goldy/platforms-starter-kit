import { Ticket, TicketComment } from '@/db/schema';
import { appBaseUrl, supportBaseUrl } from '@/lib/utils';
import { getTicketById } from '@/lib/tickets/queries';
import { createTicketToken } from '@/lib/tickets/magic-links';
import { renderAgentReplyEmail } from '@/lib/email/templates/agent-reply';
import { renderCustomerReplyEmail } from '@/lib/email/templates/customer-reply';
import { renderStatusChangedEmail } from '@/lib/email/templates/status-changed';
import { renderTicketCreatedEmail } from '@/lib/email/templates/ticket-created';
import { sendWithOutbox } from '@/lib/email/outbox';
import { getCustomerAdminEmails } from '@/lib/organizations/queries';
import { headers } from 'next/headers';
import { getClientIP } from '@/lib/rate-limit';

/**
 * Send email notification when agent replies to a ticket
 */
export async function sendAgentReplyNotification(
  ticket: Ticket & {
    requester: { email: string; name: string | null } | null;
    organization: { name: string };
  },
  comment: TicketComment & {
    user: { name: string | null; email: string } | null;
  },
  ticketUrl?: string
) {
  // Only send if ticket has a requester email
  if (!ticket.requesterEmail && !ticket.requester?.email) {
    return;
  }

  const primaryEmail = ticket.requesterEmail || ticket.requester?.email;
  const ccList = Array.isArray(ticket.ccEmails) ? ticket.ccEmails : [];
  const recipients = [
    ...(primaryEmail ? [primaryEmail] : []),
    ...ccList.filter((value) => typeof value === 'string' && value.trim().length > 0),
  ];
  const uniqueRecipients = Array.from(new Set(recipients));
  if (uniqueRecipients.length === 0) return;

  const agentName = comment.user?.name || comment.user?.email || 'Support Team';
  const ticketKey = ticket.key;

  const email = renderAgentReplyEmail({
    ticketKey,
    subject: ticket.subject,
    agentName,
    comment: comment.content,
    ticketUrl,
  });

  for (const address of uniqueRecipients) {
    await sendWithOutbox({
      type: 'agent_reply',
      to: address,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }
}

/**
 * Send email notification when customer replies to a ticket
 */
export async function sendCustomerReplyNotification(
  ticketId: string,
  comment: TicketComment & {
    user: { name: string | null; email: string } | null;
    authorEmail: string | null;
  }
) {
  // Get ticket with assignee info
  const ticket = await getTicketById(ticketId);
  if (!ticket || !('assignee' in ticket) || !ticket.assignee) {
    return; // Only notify if ticket is assigned
  }

  const ticketWithAssignee = ticket as Ticket & {
    assignee: { name: string | null; email: string } | null;
  };

  const customerName =
    comment.user?.name || comment.authorEmail || comment.user?.email || 'Customer';
  const ticketUrl = `${appBaseUrl}/app/tickets/${ticketId}`;

  const email = renderCustomerReplyEmail({
    ticketKey: ticket.key,
    subject: ticket.subject,
    customerName,
    comment: comment.content,
    ticketUrl,
  });

  await sendWithOutbox({
    type: 'customer_reply',
    to: ticketWithAssignee.assignee?.email || '',
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}

/**
 * Send email notification when customer creates a ticket (for internal queue)
 */
export async function sendCustomerTicketCreatedNotification(
  ticket: Ticket & {
    requester: { email: string; name: string | null } | null;
    organization: { name: string };
  }
) {
  const supportInbox = process.env.SUPPORT_INBOX_EMAIL;
  const ticketUrl = `${appBaseUrl}/app/tickets/${ticket.id}`;

  if (!supportInbox) {
    console.log(`[Email Notification] New customer ticket created: ${ticket.key} - ${ticketUrl}`);
    return;
  }

  const email = renderCustomerReplyEmail({
    ticketKey: ticket.key,
    subject: ticket.subject,
    customerName: ticket.requester?.name || ticket.requester?.email || 'Customer',
    comment: ticket.description,
    ticketUrl,
  });

  await sendWithOutbox({
    type: 'customer_ticket_created',
    to: supportInbox,
    subject: `New Ticket: ${ticket.key} - ${ticket.subject}`,
    html: email.html,
    text: email.text,
  });
}

/**
 * Send email notification when ticket status changes
 */
export async function sendTicketStatusChangedNotification(
  ticket: Ticket & {
    requester: { email: string; name: string | null } | null;
  },
  oldStatus: string,
  newStatus: string
) {
  const primaryEmail = ticket.requesterEmail || ticket.requester?.email;
  const ccList = Array.isArray(ticket.ccEmails) ? ticket.ccEmails : [];
  const recipients = [
    ...(primaryEmail ? [primaryEmail] : []),
    ...ccList.filter((value) => typeof value === 'string' && value.trim().length > 0),
  ];
  const uniqueRecipients = Array.from(new Set(recipients));
  if (uniqueRecipients.length === 0) return;

  for (const address of uniqueRecipients) {
    const token = await createTicketToken({
      ticketId: ticket.id,
      email: address,
      purpose: 'VIEW',
      lastSentAt: new Date(),
    });
    const ticketUrl = `${supportBaseUrl}/ticket/${token}`;

    const email = renderStatusChangedEmail({
      ticketKey: ticket.key,
      subject: ticket.subject,
      oldStatus,
      newStatus,
      ticketUrl,
    });

    await sendWithOutbox({
      type: 'ticket_status_changed',
      to: address,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }
}

/**
 * Send email notification to customer admins when an admin creates a ticket for their organization
 */
export async function sendAdminCreatedTicketNotification(
  ticket: Ticket & {
    organization: { name: string };
  }
) {
  // Get customer admin emails for the organization
  const adminEmails = await getCustomerAdminEmails(ticket.orgId);
  
  if (adminEmails.length === 0) {
    // No customer admins to notify
    return;
  }

  const headersList = await headers();
  const ip = getClientIP(headersList);

  // Send email to each customer admin with a magic link
  await Promise.all(
    adminEmails.map(async (email) => {
      const token = await createTicketToken({
        ticketId: ticket.id,
        email,
        purpose: 'VIEW',
        createdIp: ip,
        lastSentAt: new Date(),
      });
      const magicLink = `${supportBaseUrl}/ticket/${token}`;

      const emailContent = renderTicketCreatedEmail({
        ticketKey: ticket.key,
        subject: ticket.subject,
        magicLink,
      });

      await sendWithOutbox({
        type: 'admin_created_ticket',
        to: email,
        subject: `New Ticket Created for ${ticket.organization.name}: ${ticket.key}`,
        html: emailContent.html,
        text: emailContent.text,
      });
    })
  );
}
