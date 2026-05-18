import Link from 'next/link';
import {
  Activity,
  Bell,
  CheckCircle2,
  Database,
  ExternalLink,
  KeyRound,
  Mail,
  RadioTower,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import { db } from '@/db';
import { organizations, zabbixConfigs } from '@/db/schema';
import { requireInternalRole } from '@/lib/auth/permissions';
import { desc, eq } from 'drizzle-orm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeaderWithBack } from '@/components/navigation/back-button';

const AVAILABLE_INTEGRATIONS = [
  {
    id: 'zabbix',
    name: 'Zabbix',
    category: 'Monitoring',
    status: 'Available',
    description: 'Sync hosts, service health, and monitoring state from Zabbix.',
    href: '/app/admin/zabbix',
    icon: RadioTower,
  },
  {
    id: 'smtp',
    name: 'Email SMTP',
    category: 'Communication',
    status: 'Available',
    description: 'Use SMTP as a notification and ticket update delivery channel.',
    href: '/app/admin/email-test',
    icon: Mail,
  },
  {
    id: 'webhooks',
    name: 'Webhooks',
    category: 'Automation',
    status: 'Available',
    description: 'Send signed ticket and workflow events to external systems.',
    href: '/app/settings/webhooks',
    icon: Webhook,
  },
  {
    id: 'sso',
    name: 'SSO Providers',
    category: 'Security',
    status: 'Planned',
    description: 'Centralized identity integrations for customer and agent access.',
    href: null,
    icon: ShieldCheck,
  },
  {
    id: 'storage',
    name: 'Object Storage',
    category: 'Storage',
    status: 'Planned',
    description: 'External storage backends for attachments, exports, and archives.',
    href: null,
    icon: Database,
  },
  {
    id: 'api-keys',
    name: 'API Keys',
    category: 'Developer',
    status: 'Planned',
    description: 'Programmatic access for custom tooling and private integrations.',
    href: null,
    icon: KeyRound,
  },
] as const;

function statusBadge(status: string) {
  if (status === 'Available') {
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Available</Badge>;
  }
  return <Badge variant="secondary">Planned</Badge>;
}

export default async function IntegrationsPage() {
  await requireInternalRole();

  const configuredZabbix = await db
    .select({
      id: zabbixConfigs.id,
      isActive: zabbixConfigs.isActive,
      lastSyncedAt: zabbixConfigs.lastSyncedAt,
      updatedAt: zabbixConfigs.updatedAt,
      orgName: organizations.name,
      orgId: organizations.id,
    })
    .from(zabbixConfigs)
    .leftJoin(organizations, eq(zabbixConfigs.orgId, organizations.id))
    .orderBy(desc(zabbixConfigs.updatedAt));

  return (
    <div className="max-w-6xl space-y-8">
      <PageHeaderWithBack
        title="Integrations"
        description="Connect Atlas to monitoring, communication, storage, and security tools."
        backHref="/app"
        backLabel="Back to Dashboard"
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-md bg-green-100 p-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Configured</p>
              <p className="text-2xl font-semibold">{configuredZabbix.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-md bg-blue-100 p-2 text-blue-700">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Available</p>
              <p className="text-2xl font-semibold">
                {AVAILABLE_INTEGRATIONS.filter((item) => item.status === 'Available').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-md bg-amber-100 p-2 text-amber-700">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Planned</p>
              <p className="text-2xl font-semibold">
                {AVAILABLE_INTEGRATIONS.filter((item) => item.status === 'Planned').length}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Configured Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Active connections currently attached to tenant organizations.
          </p>
        </div>

        {configuredZabbix.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6">
              <p className="font-medium">No integrations configured</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start with Zabbix if you want monitoring data and service health synced into Atlas.
              </p>
              <Button asChild className="mt-4">
                <Link href="/app/admin/zabbix">Configure Zabbix</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {configuredZabbix.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex items-start justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <RadioTower className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-semibold">Zabbix</h3>
                      {item.isActive ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <p className="mt-2 truncate text-sm text-muted-foreground">
                      {item.orgName || 'Unknown organization'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Last sync: {item.lastSyncedAt ? item.lastSyncedAt.toLocaleString() : 'Never'}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/app/admin/zabbix">Manage</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Integration Catalog</h2>
          <p className="text-sm text-muted-foreground">
            Choose an implemented provider or track planned integration areas.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {AVAILABLE_INTEGRATIONS.map((integration) => {
            const Icon = integration.icon;
            const content = (
              <Card className="h-full transition-shadow hover:shadow-sm">
                <CardHeader className="space-y-0 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-muted p-2">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{integration.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{integration.category}</p>
                      </div>
                    </div>
                    {statusBadge(integration.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{integration.description}</p>
                  {integration.href ? (
                    <div className="mt-4 flex items-center text-sm font-medium text-primary">
                      Configure
                      <ExternalLink className="ml-2 h-3.5 w-3.5" />
                    </div>
                  ) : (
                    <p className="mt-4 text-sm font-medium text-muted-foreground">Roadmap item</p>
                  )}
                </CardContent>
              </Card>
            );

            return integration.href ? (
              <Link key={integration.id} href={integration.href} className="block">
                {content}
              </Link>
            ) : (
              <div key={integration.id}>{content}</div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
