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
    <p><strong>${escapeHtml(customerName)}</strong> replied to ticket <strong>${escapeHtml(ticketKey)}</strong>:</p>
    
    <div style="background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 6px; padding: 20px; margin: 25px 0;">
      <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #111827;">
        ${formatMultilineText(comment)}
      </p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${ticketUrl}" class="btn">View Ticket</a>
    </div>
    
    <p style="font-size: 12px; color: #6b7280; text-align: center;">
      Subject: ${escapeHtml(subject)}
    </p>
  `;

  return {
    subject: `[${ticketKey}] New reply from ${customerName}`,
    html: renderBaseTemplate({
      title: 'Customer Reply',
      preheader: `${customerName} replied to ticket ${ticketKey}`,
      bodyHtml,
    }),
    text: `New reply from ${customerName} on ticket ${ticketKey}\n\n${comment}\n\nView ticket: ${ticketUrl}\n\nSubject: ${subject}`,
  };
}
