import type { EmailService, EmailOptions } from './types';

export class ConsoleEmailService implements EmailService {
  async send(options: EmailOptions): Promise<void> {
    console.log('='.repeat(60));
    console.log('📧 EMAIL (Console Fallback)');
    console.log('='.repeat(60));
    console.log('To:', options.to);
    if (options.cc) console.log('CC:', options.cc);
    if (options.bcc) console.log('BCC:', options.bcc);
    if (options.replyTo) console.log('Reply-To:', options.replyTo);
    console.log('Subject:', options.subject);
    if (options.html) {
      console.log('HTML:');
      console.log(options.html);
    }
    if (options.text) {
      console.log('Text:');
      console.log(options.text);
    }
    if (options.attachments) {
      console.log('Attachments:', options.attachments.map(a => a.filename).join(', '));
    }
    console.log('='.repeat(60));
  }
}

export const emailService: EmailService = new ConsoleEmailService();

