/**
 * Invitation email templates
 */

import { sendWithOutbox } from './outbox';

export interface InvitationEmailData {
  email: string;
  invitationLink: string;
  orgName: string;
}

/**
 * Send user invitation email
 */
export async function sendInvitationEmail(data: InvitationEmailData): Promise<void> {
  const subject = `You've been invited to join ${data.orgName}`;
  
  // Get base URL from invitation link
  const baseUrl = data.invitationLink.split('/invite/')[0];
  const logoUrl = `${baseUrl}/logo/atlas-logo.png`;
  const currentYear = new Date().getFullYear();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
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
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">You're Invited!</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    Hi there,
                  </p>
                  
                  <p style="color: #555555; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0;">
                    You've been invited to join <strong>${data.orgName}</strong> on the <strong>atlas</strong>.
                  </p>
                  
                  <!-- Invitation Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 6px; margin: 25px 0;">
                    <tr>
                      <td style="padding: 25px;">
                        <h3 style="color: #1a1a2e; margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #f97316; padding-bottom: 10px;">Organization Details</h3>
                        <p style="color: #555555; font-size: 14px; margin: 0 0 10px 0;">
                          <strong>Organization:</strong> ${data.orgName}
                        </p>
                        <p style="color: #555555; font-size: 14px; margin: 0;">
                          <strong>Email:</strong> ${data.email}
                        </p>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="color: #555555; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0;">
                    Click the button below to accept your invitation and set up your account:
                  </p>
                  
                  <!-- Accept Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${data.invitationLink}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);">
                          Accept Invitation
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="color: #666666; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0; text-align: center; font-style: italic;">
                    Or copy this link: <a href="${data.invitationLink}" style="color: #f97316; word-break: break-all;">${data.invitationLink}</a>
                  </p>
                  
                  <!-- Info Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 30px; background-color: #fef3c7; border-radius: 6px;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="color: #92400e; font-size: 13px; margin: 0;">
                          <strong>⏰ Important:</strong> This invitation link will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Contact Info -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 30px; background-color: #f8f9fa; border-radius: 6px;">
                    <tr>
                      <td style="padding: 20px; text-align: center;">
                        <p style="color: #666666; font-size: 13px; margin: 0 0 10px 0;">Need help?</p>
                        <p style="color: #333333; font-size: 14px; margin: 0; font-weight: 600;">
                          📧 support@agrnetworks.com<br>
                          🌐 <a href="${baseUrl}" style="color: #f97316; text-decoration: none;">www.agrnetworks.com</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #1a1a2e; padding: 20px; text-align: center;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    © ${currentYear} AGR Networks. All rights reserved.<br>
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

  const text = `
AGR Networks - Invitation to Join ${data.orgName}

Hi there,

You've been invited to join ${data.orgName} on the atlas.

ORGANIZATION DETAILS
====================
Organization: ${data.orgName}
Email: ${data.email}

ACCEPT INVITATION
=================
${data.invitationLink}

⏰ IMPORTANT: This invitation link will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

Need help?
Email: support@agrnetworks.com
Website: ${baseUrl}

© ${currentYear} AGR Networks. All rights reserved.
`;

  await sendWithOutbox({
    type: 'invitation',
    to: data.email,
    subject,
    html,
    text,
  });
}
