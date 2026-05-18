import { escapeHtml, renderBaseTemplate } from "./utils";

export function renderTicketCreatedEmail(options: {
  ticketKey: string;
  subject: string;
  magicLink: string;
  senderEmail?: string;
  createdAt?: string;
}) {
  const { ticketKey, subject, magicLink, senderEmail, createdAt } = options;
  const title = `Ticket Created: ${ticketKey}`;

  // Get base URL from magic link
  const baseUrl = magicLink.split("/ticket/")[0];
  const currentDate =
    createdAt ||
    new Date().toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const bodyHtml = `
    <p>Hi there,</p>
    
    <p>Thank you for contacting <strong>AGR Networks Support</strong>. Your ticket has been received and assigned to our team. We typically respond within <strong>2-4 hours</strong> during business hours.</p>
    
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
          <td style="padding: 5px 0; color: #6b7280; font-size: 14px;">Status:</td>
          <td style="padding: 5px 0;">
            <span style="background-color: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600;">NEW</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #6b7280; font-size: 14px;">Submitted:</td>
          <td style="padding: 5px 0; color: #111827; font-size: 14px;">${currentDate}</td>
        </tr>
        ${
          senderEmail
            ? `
        <tr>
          <td style="padding: 5px 0; color: #6b7280; font-size: 14px;">Email:</td>
          <td style="padding: 5px 0; color: #111827; font-size: 14px;">${escapeHtml(senderEmail)}</td>
        </tr>
        `
            : ""
        }
      </table>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${magicLink}" class="btn">View Ticket Status</a>
    </div>
    
    <p style="text-align: center; font-size: 13px; color: #6b7280;">
      Or copy this link: <a href="${magicLink}" style="color: #f97316;">${magicLink}</a>
    </p>
    
    <div style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
      <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #111827;">What's Next?</h4>
      <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px;">
        <li>Our support team will review your request</li>
        <li>You'll receive email updates on any progress</li>
        <li>Use the link above to check status anytime</li>
      </ul>
    </div>
    
    <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 30px;">
      This link is valid for 30 days. Anyone with the link can view this ticket.
    </p>
  `;

  const text = `AGR Networks - Support Ticket Confirmation

Hi there,

Thank you for contacting AGR Networks Support. Your ticket has been received and assigned to our team.

TICKET DETAILS
==============
Ticket ID: ${ticketKey}
Subject: ${subject}
Status: NEW
Submitted: ${currentDate}
${senderEmail ? `Email: ${senderEmail}\n` : ""}

VIEW TICKET
===========
${magicLink}

WHAT'S NEXT?
============
- Our support team will review your request
- You'll receive email updates on any progress
- Use the link above to check status anytime
- Reply to this email to add more information

Need immediate assistance?
Email: support@agrnetworks.com
Website: ${baseUrl}

This link is valid for 30 days.

© ${new Date().getFullYear()} AGR Networks. All rights reserved.
`;

  return {
    subject: title,
    html: renderBaseTemplate({
      title: "Support Ticket Confirmation",
      preheader: `Ticket ${ticketKey} has been created`,
      bodyHtml,
    }),
    text,
  };
}
