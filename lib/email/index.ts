import { ConsoleEmailService } from './console';
import { SmtpEmailService, isSmtpConfigured } from './smtp';
import { isGraphEmailConfigured, sendEmailViaGraph } from './graph-client';
import type { EmailService, EmailOptions } from './types';

/**
 * Create email service with Microsoft Graph as priority
 * Priority: Microsoft Graph > SMTP > Console (fallback)
 */
function createEmailService(): EmailService {
  // Priority 1: Microsoft Graph (Office 365 / Azure AD)
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
          console.error('[Email] Graph API failed:', error);
          // Fall back to console so emails are still visible in logs
          console.log('[Email Fallback] Would have sent:', {
            to: options.to,
            subject: options.subject,
          });
          throw error; // Re-throw so caller knows it failed
        }
      },
    };
  }

  // Priority 2: SMTP (if configured)
  if (isSmtpConfigured()) {
    console.log('[Email] Using SMTP');
    return new SmtpEmailService();
  }

  // Priority 3: Console (fallback - for development)
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

/**
 * Get current email provider name
 */
export function getEmailProvider(): string {
  if (isGraphEmailConfigured()) return 'microsoft-graph';
  if (isSmtpConfigured()) return 'smtp';
  return 'console';
}

export type { EmailOptions, EmailService } from './types';
