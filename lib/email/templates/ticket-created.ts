import { escapeHtml } from './utils';

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
  const baseUrl = magicLink.split('/ticket/')[0];
  const logoUrl = `${baseUrl}/logo/atlas-logo.png`;
  const currentDate = createdAt || new Date().toLocaleString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(title)}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
              <!-- Header with Logo -->
              <tr>
                <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; text-align: center;">
                  <img src="${logoUrl}" alt="AGR Networks" style="height: 50px; width: auto; margin-bottom: 10px;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Support Ticket Confirmation</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    Hi <strong>there</strong>,
                  </p>
                  
                  <p style="color: #555555; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0;">
                    Thank you for contacting <strong>AGR Networks Support</strong>. Your ticket has been received and assigned to our team. We typically respond within <strong>2-4 hours</strong> during business hours.
                  </p>
                  
                  <!-- Ticket Details Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 6px; margin: 25px 0;">
                    <tr>
                      <td style="padding: 25px;">
                        <h3 style="color: #1a1a2e; margin: 0 0 20px 0; font-size: 18px; border-bottom: 2px solid #f97316; padding-bottom: 10px;">Ticket Details</h3>
                        
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; width: 120px;"><strong>Ticket ID:</strong></td>
                            <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: 600;">${escapeHtml(ticketKey)}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Subject:</strong></td>
                            <td style="padding: 8px 0; color: #333333; font-size: 14px;">${escapeHtml(subject)}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Status:</strong></td>
                            <td style="padding: 8px 0;">
                              <span style="background-color: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">NEW</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Submitted:</strong></td>
                            <td style="padding: 8px 0; color: #333333; font-size: 14px;">${currentDate}</td>
                          </tr>
                          ${senderEmail ? `
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Email:</strong></td>
                            <td style="padding: 8px 0; color: #333333; font-size: 14px;">${escapeHtml(senderEmail)}</td>
                          </tr>
                          ` : ''}
                        </table>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Magic Link Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);">
                          View Ticket Status
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="color: #666666; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0; text-align: center; font-style: italic;">
                    Or copy this link: <a href="${magicLink}" style="color: #f97316; word-break: break-all;">${magicLink}</a>
                  </p>
                  
                  <!-- Additional Info -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 25px;">
                    <tr>
                      <td>
                        <h4 style="color: #1a1a2e; margin: 0 0 15px 0; font-size: 16px;">What's Next?</h4>
                        <ul style="color: #555555; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                          <li>Our support team will review your request</li>
                          <li>You'll receive email updates on any progress</li>
                          <li>Use the link above to check status anytime</li>
                          <li>Reply to this email to add more information</li>
                        </ul>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Contact Info -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 30px; background-color: #f8f9fa; border-radius: 6px;">
                    <tr>
                      <td style="padding: 20px; text-align: center;">
                        <p style="color: #666666; font-size: 13px; margin: 0 0 10px 0;">Need immediate assistance?</p>
                        <p style="color: #333333; font-size: 14px; margin: 0; font-weight: 600;">
                          📧 support@agrnetworks.com<br>
                          🌐 <a href="${baseUrl}" style="color: #f97316; text-decoration: none;">www.agrnetworks.com</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 25px 0 0 0;">
                    This link is valid for 30 days. Anyone with the link can view this ticket.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #1a1a2e; padding: 20px; text-align: center;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} AGR Networks. All rights reserved.<br>
                    This is an automated message from our support system.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
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
${senderEmail ? `Email: ${senderEmail}\n` : ''}

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
    html,
    text,
  };
}
