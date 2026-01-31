import { escapeHtml, renderBaseTemplate } from './utils';

export function renderTicketCreatedEmail(options: {
  ticketKey: string;
  subject: string;
  magicLink: string;
}) {
  const { ticketKey, subject, magicLink } = options;
  const title = `Ticket Created: ${ticketKey}`;
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      Your ticket has been created. Save this link to view and reply.
    </p>
    <div style="margin:16px 0;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;">
      <p style="margin:0;font-size:13px;color:#111827;">
        <strong>Ticket:</strong> ${escapeHtml(ticketKey)}<br>
        <strong>Subject:</strong> ${escapeHtml(subject)}
      </p>
    </div>
    <p style="margin:0 0 16px;font-size:14px;">
      <a href="${magicLink}" style="color:#2563eb;text-decoration:none;">View your ticket</a>
    </p>
    <p style="margin:0;font-size:12px;color:#6b7280;">
      This link is valid for 30 days. Anyone with the link can view this ticket.
    </p>
  `;

  return {
    subject: title,
    html: renderBaseTemplate({
      title,
      preheader: `Ticket ${ticketKey} created`,
      bodyHtml,
    }),
    text: `Your ticket has been created.\n\nTicket: ${ticketKey}\nSubject: ${subject}\n\nView your ticket: ${magicLink}\n\nThis link is valid for 30 days.`,
  };
}
