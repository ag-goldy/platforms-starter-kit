import nodemailer from 'nodemailer';
import type { EmailService, EmailOptions } from './types';

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  timeoutMs: number;
};

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const portValue = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const timeoutValue = process.env.SMTP_TIMEOUT_MS;

  if (!host || !portValue || !user || !pass || !from) {
    return null;
  }

  const port = Number(portValue);
  if (!Number.isFinite(port)) {
    return null;
  }

  const secure =
    process.env.SMTP_SECURE === 'true' || port === 465;

  const timeoutMs = Number(timeoutValue);
  const resolvedTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 10000;

  return { host, port, secure, user, pass, from, timeoutMs: resolvedTimeout };
}

export function isSmtpConfigured() {
  return !!getSmtpConfig();
}

export class SmtpEmailService implements EmailService {
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor() {
    const config = getSmtpConfig();
    if (!config) {
      throw new Error('SMTP is not configured');
    }

    const enableDebug = process.env.SMTP_DEBUG === 'true';
    this.from = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      logger: enableDebug,
      debug: enableDebug,
      connectionTimeout: config.timeoutMs,
      greetingTimeout: config.timeoutMs,
      socketTimeout: Math.max(config.timeoutMs, 20000),
    });
  }

  async send(options: EmailOptions): Promise<void> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments?.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      })),
    });

    const accepted = info.accepted ?? [];
    const rejected = info.rejected ?? [];

    console.log('[Email] Sent', {
      messageId: info.messageId,
      accepted,
      rejected,
      response: info.response,
    });

    if (accepted.length === 0 || rejected.length > 0) {
      throw new Error(
        `SMTP delivery issue: accepted=${accepted.length}, rejected=${rejected.length}`
      );
    }
  }
}
