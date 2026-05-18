import { escapeHtml, renderBaseTemplate } from "./utils";

export function renderSlaBreachEmail(options: {
  ticketKey: string;
  subject: string;
  slaType: "Response" | "Resolution";
  timeOverdue: string;
  ticketUrl: string;
}) {
  const { ticketKey, subject, slaType, timeOverdue, ticketUrl } = options;
  const title = `SLA Breach Alert: ${ticketKey}`;

  const bodyHtml = `
    <p style="color: #ef4444; font-weight: 600;">⚠️ SLA Breach Detected</p>
    
    <p>Ticket <strong>${escapeHtml(ticketKey)}</strong> has breached its ${escapeHtml(slaType)} SLA target.</p>
    
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 20px; margin: 25px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 5px 0; color: #991b1b; width: 120px; font-size: 14px;">Ticket ID:</td>
          <td style="padding: 5px 0; color: #7f1d1d; font-weight: 600; font-size: 14px;">${escapeHtml(ticketKey)}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #991b1b; font-size: 14px;">Subject:</td>
          <td style="padding: 5px 0; color: #7f1d1d; font-size: 14px;">${escapeHtml(subject)}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #991b1b; font-size: 14px;">Breach Type:</td>
          <td style="padding: 5px 0; color: #dc2626; font-weight: 600; font-size: 14px;">${escapeHtml(slaType)} Time</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #991b1b; font-size: 14px;">Overdue By:</td>
          <td style="padding: 5px 0; color: #dc2626; font-weight: 600; font-size: 14px;">${escapeHtml(timeOverdue)}</td>
        </tr>
      </table>
    </div>
    
    <p>Please address this ticket immediately.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${ticketUrl}" class="btn" style="background-color: #dc2626;">View Ticket</a>
    </div>
  `;

  const text = `SLA Breach Alert: ${ticketKey}

Ticket ${ticketKey} has breached its ${slaType} SLA target.
Overdue By: ${timeOverdue}

Ticket: ${ticketKey}
Subject: ${subject}

View Ticket: ${ticketUrl}
`;

  return {
    subject: `[SLA BREACH] Ticket ${ticketKey}`,
    html: renderBaseTemplate({
      title: "SLA Breach Alert",
      preheader: `SLA Breach detected for ticket ${ticketKey}`,
      bodyHtml,
    }),
    text,
  };
}
