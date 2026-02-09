import { ConsoleEmailService } from './console';
import { SmtpEmailService, isSmtpConfigured } from './smtp';
import { isGraphEmailConfigured, sendEmailViaGraph } from './graph-client';
import type { EmailService, EmailOptions } from './types';

// Determine which email service to use
// Priority: Microsoft Graph > SMTP > Console (fallback)
function createEmailService(): EmailService {
  if (isGraphEmailConfigured()) {
    console.log('[Email] Using Microsoft Graph API');
    return {
      send: async (options: EmailOptions) => {
        try {
          await sendEmailViaGraph({
            to: options.to,
            cc: options.cc,
            bcc: options.bcc,
            subject: options.subject,
            text: options.text,
            html: options.html,
            replyTo: options.replyTo,
            attachments: options.attachments?.map(att => ({
              filename: att.filename,
              content: att.content,
              contentType: att.contentType,
            })),
          });
        } catch (error) {
          console.error('[Email] Graph API failed, falling back to console:', error);
          // Fall back to console so emails are still visible in logs
          const consoleService = new ConsoleEmailService();
          await consoleService.send(options);
        }
      },
    };
  }

  if (isSmtpConfigured()) {
    console.log('[Email] Using SMTP');
    return new SmtpEmailService();
  }

  console.log('[Email] Using Console (fallback - no email service configured)');
  return new ConsoleEmailService();
}

export const emailService: EmailService = createEmailService();

/**
 * Send an email using the configured email service
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  return emailService.send(options);
}

export type { EmailOptions, EmailService } from './types';
