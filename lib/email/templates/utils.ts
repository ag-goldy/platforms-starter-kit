const htmlEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (match) => htmlEscapes[match] || match);
}

export function formatMultilineText(value: string) {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

export function renderBaseTemplate(options: {
  title: string;
  preheader?: string;
  bodyHtml: string;
  footerHtml?: string;
  brandName?: string;
  logoUrl?: string;
  supportUrl?: string;
  supportEmail?: string;
}) {
  const { title, preheader, bodyHtml, footerHtml } = options;
  const safePreheader = preheader ? escapeHtml(preheader) : '';
  const brandName =
    options.brandName || process.env.EMAIL_BRAND_NAME || 'AGRN Support';
  const supportUrl =
    options.supportUrl || process.env.EMAIL_SUPPORT_URL || '';
  const supportEmail =
    options.supportEmail ||
    process.env.SUPPORT_INBOX_EMAIL ||
    process.env.SMTP_USER ||
    '';
  const emailMatch = supportEmail.match(/<([^>]+)>/);
  const supportEmailValue = emailMatch ? emailMatch[1] : supportEmail;
  const logoUrl =
    options.logoUrl ||
    process.env.EMAIL_LOGO_URL ||
    `${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'}/logo/agrn-logo.svg`;

  const supportLinks = [
    supportEmailValue
      ? `<a href="mailto:${escapeHtml(supportEmailValue)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(supportEmailValue)}</a>`
      : '',
    supportUrl
      ? `<a href="${supportUrl}" style="color:#2563eb;text-decoration:none;">Support Center</a>`
      : '',
  ].filter(Boolean);

  const footerDefault = `
    <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">
      ${supportLinks.length ? `Need help? ${supportLinks.join(' • ')}` : escapeHtml(brandName)}
    </p>
    <p style="margin:0;font-size:12px;color:#9ca3af;">
      (c) ${new Date().getFullYear()} ${escapeHtml(brandName)}
    </p>
  `;

  return `
    <!doctype html>
    <html>
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)}</title>
      </head>
      <body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#111827;">
        <div style="display:none;max-height:0;overflow:hidden;">${safePreheader}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding:24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:18px 28px;background:#111827;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:middle;">
                          ${
                            logoUrl
                              ? `<img src="${logoUrl}" alt="${escapeHtml(brandName)}" height="28" style="display:block;" />`
                              : `<span style="color:#ffffff;font-size:16px;font-weight:700;">${escapeHtml(brandName)}</span>`
                          }
                        </td>
                        <td align="right" style="vertical-align:middle;font-size:12px;color:#d1d5db;">
                          ${supportUrl ? `<a href="${supportUrl}" style="color:#d1d5db;text-decoration:none;">Support</a>` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 28px;border-bottom:1px solid #e5e7eb;">
                    <h1 style="margin:0;font-size:20px;line-height:1.4;">${escapeHtml(title)}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 28px;">
                    ${bodyHtml}
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
                    ${footerHtml || footerDefault}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
