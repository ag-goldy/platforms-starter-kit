// Official integration logos as SVG components
// Using simple color schemes for brand recognition

export const ZabbixLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill="#D40000"/>
    <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">Z</text>
  </svg>
);

export const SlackLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill="#4A154B"/>
    <g fill="white">
      <rect x="8" y="14" width="3" height="8" rx="1.5"/>
      <rect x="14" y="8" width="3" height="8" rx="1.5"/>
      <rect x="14" y="19" width="3" height="5" rx="1.5"/>
      <rect x="21" y="14" width="3" height="5" rx="1.5"/>
    </g>
  </svg>
);

export const AWSS3Logo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill="#569A31"/>
    <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">S3</text>
  </svg>
);

export const DatadogLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill="#632CA6"/>
    <path d="M16 8L24 12V20L16 24L8 20V12L16 8Z" fill="white"/>
    <circle cx="16" cy="16" r="3" fill="#632CA6"/>
  </svg>
);

export const OktaLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill="#007DC1"/>
    <circle cx="16" cy="16" r="6" fill="none" stroke="white" strokeWidth="2"/>
    <circle cx="16" cy="16" r="2" fill="white"/>
  </svg>
);

export const TeamsLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill="#6264A7"/>
    <rect x="8" y="10" width="7" height="5" rx="1" fill="white"/>
    <rect x="17" y="10" width="7" height="5" rx="1" fill="white" opacity="0.7"/>
    <rect x="8" y="17" width="7" height="5" rx="1" fill="white" opacity="0.7"/>
    <rect x="17" y="17" width="7" height="5" rx="1" fill="white"/>
  </svg>
);

export const EmailLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill="#EA4335"/>
    <path d="M8 12L16 18L24 12V20C24 20.5304 23.7893 21.0391 23.4142 21.4142C23.0391 21.7893 22.5304 22 22 22H10C9.46957 22 8.96086 21.7893 8.58579 21.4142C8.21071 21.0391 8 20.5304 8 20V12Z" fill="white"/>
    <path d="M8 10C8 9.46957 8.21071 8.96086 8.58579 8.58579C8.96086 8.21071 9.46957 8 10 8H22C22.5304 8 23.0391 8.21071 23.4142 8.58579C23.7893 8.96086 24 9.46957 24 10V12L16 18L8 12V10Z" fill="white" opacity="0.8"/>
  </svg>
);

export const WebhookLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill="#6B7280"/>
    <path d="M10 14C10 14 12 10 16 10C20 10 22 14 22 14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <path d="M22 18C22 18 20 22 16 22C12 22 10 18 10 18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="16" cy="16" r="2" fill="white"/>
  </svg>
);

// Logo mapping
export const INTEGRATION_LOGOS = {
  zabbix: ZabbixLogo,
  slack: SlackLogo,
  s3: AWSS3Logo,
  datadog: DatadogLogo,
  okta: OktaLogo,
  teams: TeamsLogo,
  email: EmailLogo,
  webhook: WebhookLogo,
};
