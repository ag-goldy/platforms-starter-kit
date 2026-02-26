'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ZabbixLogo,
  SlackLogo,
  AWSS3Logo,
  DatadogLogo,
  OktaLogo,
  TeamsLogo,
  EmailLogo,
  WebhookLogo,
} from './integration-logos';

export interface IntegrationType {
  id: string;
  name: string;
  description: string;
  logo: React.ComponentType<{ className?: string }>;
  category: 'monitoring' | 'communication' | 'storage' | 'security' | 'other';
  status: 'available' | 'coming_soon' | 'beta';
  popular?: boolean;
}

const INTEGRATION_TYPES: IntegrationType[] = [
  {
    id: 'zabbix',
    name: 'Zabbix',
    description: 'Monitor infrastructure and service health with Zabbix integration',
    logo: ZabbixLogo,
    category: 'monitoring',
    status: 'available',
    popular: true,
  },
  {
    id: 'email',
    name: 'Email (SMTP)',
    description: 'Send notifications and updates via your SMTP server',
    logo: EmailLogo,
    category: 'communication',
    status: 'available',
  },
  {
    id: 'webhook',
    name: 'Custom Webhook',
    description: 'Integrate with any service using custom webhooks',
    logo: WebhookLogo,
    category: 'other',
    status: 'available',
  },
  {
    id: 's3',
    name: 'AWS S3',
    description: 'Store attachments and exports in S3 buckets',
    logo: AWSS3Logo,
    category: 'storage',
    status: 'coming_soon',
  },
  {
    id: 'datadog',
    name: 'Datadog',
    description: 'Send metrics and events to Datadog for monitoring',
    logo: DatadogLogo,
    category: 'monitoring',
    status: 'coming_soon',
  },
  {
    id: 'okta',
    name: 'Okta SSO',
    description: 'Single sign-on with Okta identity provider',
    logo: OktaLogo,
    category: 'security',
    status: 'beta',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get notifications and create tickets from Slack',
    logo: SlackLogo,
    category: 'communication',
    status: 'coming_soon',
    popular: true,
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Collaborate on tickets within Microsoft Teams',
    logo: TeamsLogo,
    category: 'communication',
    status: 'coming_soon',
  },
];

interface IntegrationChooserProps {
  onSelect: (integration: IntegrationType) => void;
  selectedId?: string;
  filterCategory?: IntegrationType['category'];
}

export function IntegrationChooser({
  onSelect,
  selectedId,
  filterCategory,
}: IntegrationChooserProps) {
  const integrations = filterCategory
    ? INTEGRATION_TYPES.filter((i) => i.category === filterCategory)
    : INTEGRATION_TYPES;

  const categories = [
    { id: 'monitoring', label: 'Monitoring', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { id: 'communication', label: 'Communication', color: 'bg-green-50 text-green-700 border-green-200' },
    { id: 'storage', label: 'Storage', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { id: 'security', label: 'Security', color: 'bg-red-50 text-red-700 border-red-200' },
    { id: 'other', label: 'Other', color: 'bg-gray-50 text-gray-700 border-gray-200' },
  ];

  return (
    <div className="space-y-6">
      {/* Category filters */}
      {!filterCategory && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <Badge
              key={cat.id}
              variant="outline"
              className={cn('cursor-pointer hover:opacity-80', cat.color)}
            >
              {cat.label}
            </Badge>
          ))}
        </div>
      )}

      {/* Integration grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            isSelected={selectedId === integration.id}
            onClick={() => onSelect(integration)}
          />
        ))}
      </div>
    </div>
  );
}

interface IntegrationCardProps {
  integration: IntegrationType;
  isSelected?: boolean;
  onClick: () => void;
}

function IntegrationCard({ integration, isSelected, onClick }: IntegrationCardProps) {
  const statusColors = {
    available: 'bg-green-100 text-green-700',
    beta: 'bg-yellow-100 text-yellow-700',
    coming_soon: 'bg-gray-100 text-gray-500',
  };

  const isDisabled = integration.status === 'coming_soon';
  const LogoComponent = integration.logo;

  return (
    <Card
      className={cn(
        'relative cursor-pointer transition-all duration-200 hover:shadow-md',
        isSelected && 'ring-2 ring-blue-500 shadow-md',
        isDisabled && 'opacity-60 cursor-not-allowed hover:shadow-none'
      )}
      onClick={() => !isDisabled && onClick()}
    >
      {/* Popular badge */}
      {integration.popular && (
        <div className="absolute -top-2 -right-2">
          <Badge className="bg-gradient-to-r from-orange-400 to-pink-500 text-white border-0">
            Popular
          </Badge>
        </div>
      )}

      {/* Status badge */}
      <div className="absolute top-3 right-3">
        <Badge variant="secondary" className={cn('text-xs', statusColors[integration.status])}>
          {integration.status === 'coming_soon' ? 'Coming Soon' : integration.status === 'beta' ? 'Beta' : 'Available'}
        </Badge>
      </div>

      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Official Logo */}
          <div className="relative">
            <LogoComponent className="w-12 h-12" />
          </div>

          {/* Name */}
          <div>
            <h3 className="font-semibold text-lg">{integration.name}</h3>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
              {integration.description}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { INTEGRATION_TYPES };
