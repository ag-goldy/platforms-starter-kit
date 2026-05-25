import { escapeHtml, renderBaseTemplate } from "./utils";

export function renderTicketResolvedEmail(options: {
  ticketKey: string;
  subject: string;
  resolvedBy: string;
  resolutionNotes?: string;
  ticketUrl: string;
}) {
  const { ticketKey, subject, resolvedBy, resolutionNotes, ticketUrl } =
    options;
  const title = `Ticket Resolved: ${ticketKey}`;

  const bodyHtml = `
    <p>Hi there,</p>
    
    <p>Your ticket <strong>${escapeHtml(ticketKey)}</strong> has been marked as <strong>Resolved</strong> by ${escapeHtml(resolvedBy)}.</p>
    
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 20px; margin: 25px 0;">
      <h3 style="margin: 0 0 15px 0; color: #166534; font-size: 16px; border-bottom: 1px solid #bbf7d0; padding-bottom: 10px;">Resolution Details</h3>
      
      ${
        resolutionNotes
          ? `
      <p style="color: #15803d; font-size: 14px; margin: 0 0 15px 0;">
        ${escapeHtml(resolutionNotes)}
      </p>
      `
          : ""
      }
      
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 5px 0; color: #166534; width: 100px; font-size: 14px;">Ticket ID:</td>
          <td style="padding: 5px 0; color: #14532d; font-weight: 600; font-size: 14px;">${escapeHtml(ticketKey)}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #166534; font-size: 14px;">Subject:</td>
          <td style="padding: 5px 0; color: #14532d; font-size: 14px;">${escapeHtml(subject)}</td>
        </tr>
      </table>
    </div>
    
    <p>If you believe this ticket was resolved in error, you can reply to this email to reopen it.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${ticketUrl}" class="btn">View Ticket</a>
    </div>
  `;

  const text = `Ticket Resolved: ${ticketKey}

Your ticket has been marked as Resolved by ${resolvedBy}.

${resolutionNotes ? `Resolution Notes: ${resolutionNotes}\n` : ""}

Ticket: ${ticketKey}
Subject: ${subject}

If you believe this was in error, please reply to this email.

View Ticket: ${ticketUrl}
`;

  return {
    subject: `[${ticketKey}] Ticket resolved`,
    html: renderBaseTemplate({
      title: "Ticket Resolved",
      preheader: `Ticket ${ticketKey} has been resolved`,
      bodyHtml,
    }),
    text,
  };
}
