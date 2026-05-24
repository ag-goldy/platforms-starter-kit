import { renderBase } from "./base";
import { DEFAULT_EMAIL_ORG, type EmailTemplateOrg } from "./defaults";
import { escapeHtml } from "./utils";

type TicketCreatedOptions = {
  ticket?: {
    key: string;
    subject: string;
  };
  ticketKey?: string;
  subject?: string;
  ticketUrl?: string;
  magicLink?: string;
  requester?: {
    name?: string | null;
  };
  org?: EmailTemplateOrg;
};

export function renderTicketCreatedEmail(options: TicketCreatedOptions) {
  const ticketKey = options.ticket?.key || options.ticketKey || "";
  const subject = options.ticket?.subject || options.subject || "";
  const ticketUrl = options.ticketUrl || options.magicLink || "";
  const requesterName = options.requester?.name?.trim() || "there";
  const org = options.org || DEFAULT_EMAIL_ORG;

  const contentHtml = `
    <p style="margin:0 0 16px 0;">Hi ${escapeHtml(requesterName)},</p>
    <p style="margin:0 0 16px 0;">We've received your request and assigned it ticket ${escapeHtml(ticketKey)}.</p>
    <p style="margin:0 0 16px 0;"><strong>${escapeHtml(subject)}</strong></p>
    <p style="margin:0 0 16px 0;">View ticket: <a href="${escapeHtml(ticketUrl)}" style="color:${escapeHtml(org.brandColor || DEFAULT_EMAIL_ORG.brandColor || "#f97316")}; text-decoration:underline;">${escapeHtml(ticketUrl)}</a></p>
    <p style="margin:0;">Thanks,<br>the ${escapeHtml(org.name)} team</p>
  `;

  const contentText = `Hi ${requesterName},

We've received your request and assigned it ticket ${ticketKey}.

Ticket: ${ticketKey}
Subject: ${subject}

View ticket: ${ticketUrl}

Thanks,
the ${org.name} team`;

  return {
    subject: `Ticket received: ${ticketKey}`,
    ...renderBase({
      org,
      preheader: `Ticket ${ticketKey} received`,
      contentHtml,
      contentText,
    }),
  };
}
