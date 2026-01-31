import { escapeHtml, formatMultilineText, renderBaseTemplate } from './utils';

export function renderCustomerReplyEmail(options: {
  ticketKey: string;
  subject: string;
  customerName: string;
  comment: string;
  ticketUrl: string;
}) {
  const { ticketKey, subject, customerName, comment, ticketUrl } = options;
  const title = `Customer Reply: ${ticketKey}`;
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      ${escapeHtml(customerName)} replied to ticket ${escapeHtml(ticketKey)}.
    </p>
    <div style="margin:16px 0;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#111827;">
        ${formatMultilineText(comment)}
      </p>
    </div>
    <p style="margin:0 0 12px;font-size:14px;">
      <a href="${ticketUrl}" style="color:#2563eb;text-decoration:none;">View ticket</a>
    </p>
    <p style="margin:0;font-size:12px;color:#6b7280;">
      ${escapeHtml(subject)}
    </p>
  `;

  return {
    subject: `Customer Reply: ${ticketKey} - ${subject}`,
    html: renderBaseTemplate({
      title,
      preheader: `Customer reply on ${ticketKey}`,
      bodyHtml,
    }),
    text: `Customer reply on ticket ${ticketKey}\n\n${customerName} replied:\n${comment}\n\nView ticket: ${ticketUrl}\n\nSubject: ${subject}`,
  };
}
