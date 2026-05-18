const htmlEscapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (match) => htmlEscapes[match] || match);
}

export function formatMultilineText(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br>");
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
  const safePreheader = preheader ? escapeHtml(preheader) : "";
  const brandName =
    options.brandName || process.env.EMAIL_BRAND_NAME || "AGR Networks";
  const supportUrl = options.supportUrl || process.env.EMAIL_SUPPORT_URL || "";
  const supportEmail =
    options.supportEmail ||
    process.env.SUPPORT_INBOX_EMAIL ||
    "support@agrnetworks.com";

  // Theme Colors
  const theme = {
    primary: "#f97316", // Orange
    secondary: "#000000", // Black
    text: "#333333",
    bg: "#f5f5f5",
    white: "#ffffff",
    border: "#e5e7eb",
  };

  const footerDefault = `
    <div style="text-align: center; color: #666666; font-size: 12px; line-height: 1.5;">
      <p style="margin: 0 0 10px 0;">
        &copy; ${new Date().getFullYear()} ${escapeHtml(brandName)}. All rights reserved.
      </p>
      ${supportUrl ? `<p style="margin: 0;"><a href="${supportUrl}" style="color: ${theme.primary}; text-decoration: none;">Help Center</a> • <a href="mailto:${supportEmail}" style="color: ${theme.primary}; text-decoration: none;">Contact Support</a></p>` : ""}
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(title)}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: ${theme.bg}; }
        a { color: ${theme.primary}; text-decoration: none; }
        .btn { display: inline-block; background-color: ${theme.primary}; color: ${theme.white}; padding: 12px 24px; border-radius: 6px; font-weight: 600; text-decoration: none; }
      </style>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: ${theme.bg}; color: ${theme.text};">
      <div style="display: none; max-height: 0; overflow: hidden;">
        ${safePreheader}
      </div>
      
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${theme.bg}; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: ${theme.white}; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden;">
              <!-- Header -->
              <tr>
                <td style="background-color: ${theme.secondary}; padding: 30px; text-align: center; border-bottom: 3px solid ${theme.primary};">
                  <h1 style="color: ${theme.white}; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">${escapeHtml(brandName)}</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: ${theme.secondary}; margin: 0 0 20px 0; font-size: 20px;">${escapeHtml(title)}</h2>
                  <div style="font-size: 16px; line-height: 1.6; color: ${theme.text};">
                    ${bodyHtml}
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid ${theme.border};">
                  ${footerHtml || footerDefault}
                </td>
              </tr>
            </table>
            
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px;">
              <tr>
                <td align="center" style="color: #9ca3af; font-size: 12px;">
                  This is an automated message. Please do not reply directly to this email unless instructed.
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
