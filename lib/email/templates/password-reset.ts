import { renderBase } from "./base";
import { DEFAULT_EMAIL_ORG, type EmailTemplateOrg } from "./defaults";
import { escapeHtml } from "./utils";

type PasswordResetEmailOptions = {
  url: string;
  email: string;
  org?: EmailTemplateOrg;
  expiresInMinutes?: number;
};

export function renderPasswordResetEmail({
  url,
  email,
  org,
  expiresInMinutes = 60,
}: PasswordResetEmailOptions) {
  const resolvedOrg = org || DEFAULT_EMAIL_ORG;
  const signOffName = org?.name || DEFAULT_EMAIL_ORG.name;
  const brandColor =
    resolvedOrg.brandColor || DEFAULT_EMAIL_ORG.brandColor || "#f97316";

  const contentHtml = `
    <p style="margin:0 0 16px 0;">Hi,</p>
    <p style="margin:0 0 16px 0;">We received a request to reset the password for ${escapeHtml(email)}.</p>
    <p style="margin:0 0 16px 0;"><a href="${escapeHtml(url)}" style="color:${escapeHtml(brandColor)};text-decoration:underline;">${escapeHtml(url)}</a></p>
    <p style="margin:0 0 16px 0;">This link will expire in ${expiresInMinutes} minutes.</p>
    <p style="margin:0 0 16px 0;">If you did not request this, you can ignore this email and your password will remain unchanged.</p>
    <p style="margin:0;">Thanks,<br>the ${escapeHtml(signOffName)} team</p>
  `;

  const contentText = `Hi,

We received a request to reset the password for ${email}.

${url}

This link will expire in ${expiresInMinutes} minutes.

If you did not request this, you can ignore this email and your password will remain unchanged.

Thanks,
the ${signOffName} team`;

  return {
    subject: "Reset your password",
    ...renderBase({
      org: resolvedOrg,
      preheader: `Reset the password for ${email}`,
      contentHtml,
      contentText,
    }),
  };
}
