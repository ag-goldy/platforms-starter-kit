import { renderBase } from "./base";
import { DEFAULT_EMAIL_ORG, type EmailTemplateOrg } from "./defaults";
import { escapeHtml } from "./utils";

type PasswordResetConfirmationEmailOptions = {
  email: string;
  org?: EmailTemplateOrg;
  resetAt?: Date;
};

export function renderPasswordResetConfirmationEmail({
  email,
  org,
  resetAt = new Date(),
}: PasswordResetConfirmationEmailOptions) {
  const resolvedOrg = org || DEFAULT_EMAIL_ORG;
  const signOffName = org?.name || DEFAULT_EMAIL_ORG.name;
  const resetAtText = resetAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Singapore",
  });

  const contentHtml = `
    <p style="margin:0 0 16px 0;">Hi,</p>
    <p style="margin:0 0 16px 0;">The password for ${escapeHtml(email)} was reset successfully.</p>
    <p style="margin:0 0 16px 0;">Reset at ${escapeHtml(resetAtText)}.</p>
    <p style="margin:0 0 16px 0;">If this was you, no further action is needed.</p>
    <p style="margin:0 0 16px 0;">If you did not reset your password, contact support immediately.</p>
    <p style="margin:0;">Thanks,<br>the ${escapeHtml(signOffName)} team</p>
  `;

  const contentText = `Hi,

The password for ${email} was reset successfully.

Reset at ${resetAtText}.

If this was you, no further action is needed.

If you did not reset your password, contact support immediately.

Thanks,
the ${signOffName} team`;

  return {
    subject: "Your password was reset",
    ...renderBase({
      org: resolvedOrg,
      preheader: `The password for ${email} was reset`,
      contentHtml,
      contentText,
    }),
  };
}
