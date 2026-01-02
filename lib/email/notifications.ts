import { emailService } from './index';
import { Ticket, TicketComment } from '@/db/schema';
import { protocol, rootDomain } from '@/lib/utils';
import { getTicketById } from '@/lib/tickets/queries';
import { createTicketToken } from '@/lib/tickets/magic-links';

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

  const recipientEmail = ticket.requesterEmail || ticket.requester?.email;
  if (!recipientEmail) return;

  const agentName = comment.user?.name || comment.user?.email || 'Support Team';
  const ticketKey = ticket.key;

  await emailService.send({
    to: recipientEmail,
    subject: `Re: ${ticket.subject} (${ticketKey})`,
    html: `
      <h1>New Reply on Ticket ${ticketKey}</h1>
      <p>${agentName} has replied to your ticket:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        ${comment.content.replace(/\n/g, '<br>')}
      </div>
      ${ticketUrl ? `<p><a href="${ticketUrl}">View ticket</a></p>` : ''}
      <p>Ticket: ${ticketKey}<br>
      Subject: ${ticket.subject}</p>
    `,
    text: `
New Reply on Ticket ${ticketKey}

${agentName} has replied to your ticket:

${comment.content}

${ticketUrl ? `View ticket: ${ticketUrl}` : ''}

Ticket: ${ticketKey}
Subject: ${ticket.subject}
    `,
  });
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
  if (!ticket || !ticket.assignee) {
    return; // Only notify if ticket is assigned
  }

  const customerName =
    comment.user?.name || comment.authorEmail || comment.user?.email || 'Customer';
  const ticketUrl = `${protocol}://${rootDomain}/app/tickets/${ticketId}`;

  await emailService.send({
    to: ticket.assignee.email,
    subject: `Customer Reply: ${ticket.key} - ${ticket.subject}`,
    html: `
      <h1>Customer Reply on ${ticket.key}</h1>
      <p>${customerName} has replied to ticket <strong>${ticket.key}</strong>:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        ${comment.content.replace(/\n/g, '<br>')}
      </div>
      <p><a href="${ticketUrl}">View ticket</a></p>
      <p>Subject: ${ticket.subject}</p>
    `,
    text: `
Customer Reply on ${ticket.key}

${customerName} has replied to ticket ${ticket.key}:

${comment.content}

View ticket: ${ticketUrl}

Subject: ${ticket.subject}
    `,
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
  // In a real system, you'd send this to a queue email or notify all agents
  // For MVP, we'll just log it (email service already logs to console)
  const ticketUrl = `${protocol}://${rootDomain}/app/tickets/${ticket.id}`;
  
  // TODO: In production, send to support queue email or notify assigned agents
  console.log(`[Email Notification] New customer ticket created: ${ticket.key} - ${ticketUrl}`);
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
  const recipientEmail = ticket.requesterEmail || ticket.requester?.email;
  if (!recipientEmail) return;

  const token = await createTicketToken(ticket.id, recipientEmail);
  const ticketUrl = `${protocol}://${rootDomain}/ticket/${token}`;

  await emailService.send({
    to: recipientEmail,
    subject: `Ticket ${ticket.key} status updated to ${newStatus}`,
    html: `
      <h1>Ticket Status Updated</h1>
      <p>Your ticket <strong>${ticket.key}</strong> has been updated.</p>
      <p>Status changed from <strong>${oldStatus}</strong> to <strong>${newStatus}</strong>.</p>
      <p><a href="${ticketUrl}">View your ticket</a></p>
      <p>Subject: ${ticket.subject}</p>
    `,
    text: `
Ticket Status Updated

Ticket: ${ticket.key}
Status changed from ${oldStatus} to ${newStatus}

View your ticket: ${ticketUrl}

Subject: ${ticket.subject}
    `,
  });
}
