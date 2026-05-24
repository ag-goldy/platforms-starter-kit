export type EmailTemplateOrg = {
  name: string;
  logoUrl?: string | null;
  supportEmail: string;
  brandColor?: string | null;
};

export const DEFAULT_EMAIL_BRAND_COLOR = "#f97316";

export const DEFAULT_EMAIL_ORG: EmailTemplateOrg = {
  name: "AGR Networks",
  supportEmail: "help@agrnetworks.com",
  logoUrl: process.env.EMAIL_LOGO_URL || "https://agrnetworks.com/AGR_dlogo.png",
  brandColor: DEFAULT_EMAIL_BRAND_COLOR,
};
