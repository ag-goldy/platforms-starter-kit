import { ConsoleEmailService } from './console';
import { SmtpEmailService, isSmtpConfigured } from './smtp';
import type { EmailService } from './types';

export const emailService: EmailService = isSmtpConfigured()
  ? new SmtpEmailService()
  : new ConsoleEmailService();

export type { EmailOptions, EmailService } from './types';
