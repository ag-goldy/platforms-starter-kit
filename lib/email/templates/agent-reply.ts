import { escapeHtml, formatMultilineText, renderBaseTemplate } from './utils';

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
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      ${escapeHtml(agentName)} replied to your ticket.
    </p>
    <div style="margin:16px 0;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#111827;">
        ${formatMultilineText(comment)}
      </p>
    </div>
    ${ticketUrl ? `<p style="margin:0 0 12px;font-size:14px;"><a href="${ticketUrl}" style="color:#2563eb;text-decoration:none;">View ticket</a></p>` : ''}
    <p style="margin:0;font-size:12px;color:#6b7280;">
      Ticket ${escapeHtml(ticketKey)} • ${escapeHtml(subject)}
    </p>
  `;

  return {
    subject: `Re: ${subject} (${ticketKey})`,
    html: renderBaseTemplate({
      title,
      preheader: `Reply on ticket ${ticketKey}`,
      bodyHtml,
    }),
    text: `New reply on ticket ${ticketKey}\n\n${agentName} replied:\n${comment}\n\n${ticketUrl ? `View ticket: ${ticketUrl}\n\n` : ''}Subject: ${subject}`,
  };
}
