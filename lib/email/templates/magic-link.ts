import { renderBase } from "./base";
import { DEFAULT_EMAIL_ORG, type EmailTemplateOrg } from "./defaults";
import { escapeHtml } from "./utils";

type MagicLinkEmailOptions = {
  url: string;
  email: string;
  org?: EmailTemplateOrg;
  expiresInMinutes?: number;
};

export function renderMagicLinkEmail({
  url,
  org,
  expiresInMinutes = 5,
}: MagicLinkEmailOptions) {
  const resolvedOrg = org || DEFAULT_EMAIL_ORG;
  const productName = org?.name || "Atlas";
  const signOffName = org?.name || DEFAULT_EMAIL_ORG.name;
  const brandColor =
    resolvedOrg.brandColor || DEFAULT_EMAIL_ORG.brandColor || "#f97316";

  const contentHtml = `
    <p style="margin:0 0 16px 0;">Hi,</p>
    <p style="margin:0 0 16px 0;">Click the link below to sign in to ${escapeHtml(productName)}.</p>
    <p style="margin:0 0 16px 0;"><a href="${escapeHtml(url)}" style="color:${escapeHtml(brandColor)};text-decoration:underline;">Sign in to ${escapeHtml(productName)}</a></p>
    <p style="margin:0 0 16px 0;">This link will expire in ${expiresInMinutes} minutes.</p>
    <p style="margin:0 0 16px 0;">If you did not request this, you can ignore this email.</p>
    <p style="margin:0;">Thanks,<br>the ${escapeHtml(signOffName)} team</p>
  `;

  const contentText = `Hi,

Click the link below to sign in to ${productName}.

${url}

This link will expire in ${expiresInMinutes} minutes.

If you did not request this, you can ignore this email.

Thanks,
the ${signOffName} team`;

  return {
    subject: `Sign in to ${productName}`,
    ...renderBase({
      org: resolvedOrg,
      preheader: `Sign in to ${productName}`,
      contentHtml,
      contentText,
    }),
  };
}
