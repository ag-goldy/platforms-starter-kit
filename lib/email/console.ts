import type { EmailService, EmailOptions } from './types';

export class ConsoleEmailService implements EmailService {
  async send(options: EmailOptions): Promise<void> {
    console.log('='.repeat(60));
    console.log('📧 EMAIL (Console Fallback)');
    console.log('='.repeat(60));
    console.log('To:', options.to);
    console.log('Subject:', options.subject);
    console.log('HTML:');
    console.log(options.html);
    if (options.text) {
      console.log('Text:');
      console.log(options.text);
    }
    console.log('='.repeat(60));
  }
}

export const emailService: EmailService = new ConsoleEmailService();

