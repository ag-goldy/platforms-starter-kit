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

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f9fafb; border-radius: 8px; padding: 32px; text-align: center;">
          <h1 style="color: #111827; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">
            You've been invited!
          </h1>
          <p style="color: #6b7280; margin: 0 0 32px 0; font-size: 16px;">
            You've been invited to join <strong>${data.orgName}</strong> on the support platform.
          </p>
          <a href="${data.invitationLink}" style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 16px;">
            Accept Invitation
          </a>
          <p style="color: #9ca3af; margin: 32px 0 0 0; font-size: 14px;">
            Or copy and paste this link into your browser:<br>
            <a href="${data.invitationLink}" style="color: #2563eb; word-break: break-all;">${data.invitationLink}</a>
          </p>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 32px;">
          This invitation link will expire in 7 days.
        </p>
      </body>
    </html>
  `;

  const text = `
You've been invited to join ${data.orgName} on the support platform.

Accept your invitation by clicking the link below:
${data.invitationLink}

This invitation link will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.
  `;

  await sendWithOutbox({
    type: 'notification',
    to: data.email,
    subject,
    html,
    text,
  });
}

