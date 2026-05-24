import { escapeHtml } from "./utils";
import {
  DEFAULT_EMAIL_BRAND_COLOR,
  DEFAULT_EMAIL_ORG,
  type EmailTemplateOrg,
} from "./defaults";

/*
 * To rewrite another template:
 * 1. Build inner contentHtml and contentText with just the content (no header, no footer)
 * 2. Pass to renderBase({ org, preheader, contentHtml, contentText })
 * 3. renderBase handles wrapper, logo, accent, footer, plain-text mirroring
 */

export type RenderBaseOptions = {
  org?: EmailTemplateOrg;
  preheader?: string;
  contentHtml: string;
  contentText: string;
};

function resolveOrg(org?: EmailTemplateOrg): EmailTemplateOrg {
  if (!org) return DEFAULT_EMAIL_ORG;

  return {
    ...org,
    supportEmail: org.supportEmail || DEFAULT_EMAIL_ORG.supportEmail,
    brandColor: org.brandColor || DEFAULT_EMAIL_BRAND_COLOR,
  };
}

export function renderBase({
  org,
  preheader,
  contentHtml,
  contentText,
}: RenderBaseOptions) {
  const resolvedOrg = resolveOrg(org);
  const brandColor = resolvedOrg.brandColor || DEFAULT_EMAIL_BRAND_COLOR;
  const footerText = `${resolvedOrg.name} - Reply to this email or contact ${resolvedOrg.supportEmail}`;
  const logoHtml = resolvedOrg.logoUrl
    ? `<img src="${escapeHtml(resolvedOrg.logoUrl)}" alt="${escapeHtml(resolvedOrg.name)}" style="display:block;max-height:48px;width:auto;border:0">`
    : `<div style="font-size:16px; line-height:1.5; font-weight:700; color:#1a1a1a;">${escapeHtml(resolvedOrg.name)}</div>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#fff;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"><span style="display:none!important;max-height:0;max-width:0;opacity:0;overflow:hidden">${escapeHtml(preheader || "")}</span><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fff"><tr><td align="center" style="padding:32px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border-collapse:collapse;text-align:left"><tr><td style="padding:0 0 12px">${logoHtml}</td></tr><tr><td style="height:2px;line-height:2px;font-size:0;background:${escapeHtml(brandColor)}">&nbsp;</td></tr><tr><td style="padding:28px 0 0;font-size:16px;line-height:1.5;color:#1a1a1a">${contentHtml}</td></tr><tr><td style="padding:28px 0 0;font-size:12px;line-height:1.5;color:#666">${escapeHtml(resolvedOrg.name)} &mdash; Reply to this email or contact <a href="mailto:${escapeHtml(resolvedOrg.supportEmail)}" style="color:${escapeHtml(brandColor)};text-decoration:underline">${escapeHtml(resolvedOrg.supportEmail)}</a></td></tr></table></td></tr></table></body></html>`;

  return {
    html,
    text: `${resolvedOrg.name}\n\n${contentText.trim()}\n\n${footerText}`,
  };
}
