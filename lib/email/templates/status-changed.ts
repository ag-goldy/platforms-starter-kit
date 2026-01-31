import { escapeHtml, renderBaseTemplate } from './utils';

export function renderStatusChangedEmail(options: {
  ticketKey: string;
  subject: string;
  oldStatus: string;
  newStatus: string;
  ticketUrl: string;
}) {
  const { ticketKey, subject, oldStatus, newStatus, ticketUrl } = options;
  const title = `Ticket ${ticketKey} status updated`;
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      Your ticket status changed from <strong>${escapeHtml(oldStatus)}</strong> to
      <strong>${escapeHtml(newStatus)}</strong>.
    </p>
    <p style="margin:0 0 12px;font-size:14px;">
      <a href="${ticketUrl}" style="color:#2563eb;text-decoration:none;">View your ticket</a>
    </p>
    <p style="margin:0;font-size:12px;color:#6b7280;">
      ${escapeHtml(ticketKey)} • ${escapeHtml(subject)}
    </p>
  `;

  return {
    subject: `Ticket ${ticketKey} status updated to ${newStatus}`,
    html: renderBaseTemplate({
      title,
      preheader: `Status updated for ${ticketKey}`,
      bodyHtml,
    }),
    text: `Ticket ${ticketKey} status updated\n\nStatus: ${oldStatus} -> ${newStatus}\n\nView ticket: ${ticketUrl}\n\nSubject: ${subject}`,
  };
}
