import { escapeHtml, renderBaseTemplate } from "./utils";

export function renderTicketAssignedEmail(options: {
  ticketKey: string;
  subject: string;
  assigneeName: string;
  ticketUrl: string;
}) {
  const { ticketKey, subject, assigneeName, ticketUrl } = options;
  const title = `Ticket Assigned: ${ticketKey}`;

  const bodyHtml = `
    <p>Hi there,</p>
    
    <p>Your ticket <strong>${escapeHtml(ticketKey)}</strong> has been assigned to <strong>${escapeHtml(assigneeName)}</strong>.</p>
    
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 25px 0;">
      <h3 style="margin: 0 0 15px 0; color: #111827; font-size: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Ticket Details</h3>
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
          <td style="padding: 5px 0; color: #6b7280; font-size: 14px;">Assigned To:</td>
          <td style="padding: 5px 0; color: #111827; font-size: 14px;">${escapeHtml(assigneeName)}</td>
        </tr>
      </table>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${ticketUrl}" class="btn">View Ticket</a>
    </div>
  `;

  const text = `Ticket Assigned: ${ticketKey}

Your ticket has been assigned to ${assigneeName}.

Ticket: ${ticketKey}
Subject: ${subject}
Assigned To: ${assigneeName}

View Ticket: ${ticketUrl}
`;

  return {
    subject: `[${ticketKey}] Ticket assigned to ${assigneeName}`,
    html: renderBaseTemplate({
      title: "Ticket Assigned",
      preheader: `Ticket ${ticketKey} has been assigned to ${assigneeName}`,
      bodyHtml,
    }),
    text,
  };
}
