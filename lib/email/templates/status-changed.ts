import { escapeHtml, renderBaseTemplate } from "./utils";

export function renderStatusChangedEmail(options: {
  ticketKey: string;
  subject: string;
  oldStatus: string;
  newStatus: string;
  ticketUrl: string;
}) {
  const { ticketKey, subject, oldStatus, newStatus, ticketUrl } = options;
  const title = `Status Update: ${ticketKey}`;

  const bodyHtml = `
    <p>Hi there,</p>
    
    <p>The status of ticket <strong>${escapeHtml(ticketKey)}</strong> has been updated.</p>
    
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 25px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 5px 0; color: #6b7280; width: 100px; font-size: 14px;">Ticket ID:</td>
          <td style="padding: 5px 0; color: #111827; font-weight: 600; font-size: 14px;">${escapeHtml(ticketKey)}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #6b7280; font-size: 14px;">Subject:</td>
          <td style="padding: 5px 0; color: #111827; font-size: 14px;">${escapeHtml(subject)}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #6b7280; font-size: 14px;">Status:</td>
          <td style="padding: 5px 0; color: #111827; font-size: 14px;">
            <span style="color: #6b7280; text-decoration: line-through;">${escapeHtml(oldStatus)}</span>
            <span style="margin: 0 8px;">&rarr;</span>
            <span style="font-weight: 600; color: #f97316;">${escapeHtml(newStatus)}</span>
          </td>
        </tr>
      </table>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${ticketUrl}" class="btn">View Ticket</a>
    </div>
  `;

  const text = `Status Update: ${ticketKey}

Status changed from ${oldStatus} to ${newStatus}.

Ticket: ${ticketKey}
Subject: ${subject}

View Ticket: ${ticketUrl}
`;

  return {
    subject: `Ticket ${ticketKey} Status Updated`,
    html: renderBaseTemplate({
      title: "Status Updated",
      preheader: `Status updated to ${newStatus} for ticket ${ticketKey}`,
      bodyHtml,
    }),
    text,
  };
}
