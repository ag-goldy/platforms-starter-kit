import { escapeHtml, renderBaseTemplate, formatMultilineText } from "./utils";

export function renderMentionNotificationEmail(options: {
  ticketKey: string;
  subject: string;
  mentionedBy: string;
  comment: string;
  ticketUrl: string;
}) {
  const { ticketKey, subject, mentionedBy, comment, ticketUrl } = options;
  const title = `You were mentioned in ${ticketKey}`;

  const bodyHtml = `
    <p>Hi there,</p>
    
    <p><strong>${escapeHtml(mentionedBy)}</strong> mentioned you in a comment on ticket <strong>${escapeHtml(ticketKey)}</strong>.</p>
    
    <div style="margin: 20px 0; padding: 15px; border-left: 4px solid #f97316; background-color: #f9fafb;">
      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;">
        ${formatMultilineText(comment)}
      </p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${ticketUrl}" class="btn">View Comment</a>
    </div>
    
    <p style="font-size: 12px; color: #6b7280;">
      Ticket: ${escapeHtml(ticketKey)} • ${escapeHtml(subject)}
    </p>
  `;

  const text = `You were mentioned in ${ticketKey}

${mentionedBy} mentioned you:

${comment}

View Ticket: ${ticketUrl}
`;

  return {
    subject: `You were mentioned in ${ticketKey}`,
    html: renderBaseTemplate({
      title: "New Mention",
      preheader: `${mentionedBy} mentioned you in ticket ${ticketKey}`,
      bodyHtml,
    }),
    text,
  };
}
