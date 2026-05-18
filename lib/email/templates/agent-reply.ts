import { escapeHtml, formatMultilineText, renderBaseTemplate } from "./utils";

export function renderAgentReplyEmail(options: {
  ticketKey: string;
  subject: string;
  agentName: string;
  comment: string;
  ticketUrl?: string;
}) {
  const { ticketKey, subject, agentName, comment, ticketUrl } = options;
  const title = `New Reply on ${ticketKey}`;

  const bodyHtml = `
    <p>Hi there,</p>
    
    <p><strong>${escapeHtml(agentName)}</strong> replied to your ticket:</p>
    
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 25px 0;">
      <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #111827;">
        ${formatMultilineText(comment)}
      </p>
    </div>
    
    ${
      ticketUrl
        ? `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${ticketUrl}" class="btn">View Ticket</a>
    </div>
    `
        : ""
    }
    
    <p style="font-size: 12px; color: #6b7280; text-align: center;">
      Ticket: ${escapeHtml(ticketKey)} • ${escapeHtml(subject)}
    </p>
  `;

  return {
    subject: `Re: ${subject} (${ticketKey})`,
    html: renderBaseTemplate({
      title: "New Reply",
      preheader: `${agentName} replied to ticket ${ticketKey}`,
      bodyHtml,
    }),
    text: `New reply on ticket ${ticketKey}\n\n${agentName} replied:\n${comment}\n\n${ticketUrl ? `View ticket: ${ticketUrl}\n\n` : ""}Subject: ${subject}`,
  };
}
