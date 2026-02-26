import { notFound } from 'next/navigation';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { zabbixConfigs, assets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Server, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  RefreshCw,
  Settings,
  CheckCircle,
  HardDrive,
  Link as LinkIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default async function InfrastructurePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const org = await getOrgBySubdomain(subdomain);

  if (!org) {
    notFound();
  }

  try {
    await requireOrgMemberRole(org.id, ['CUSTOMER_ADMIN']);

    // Fetch Zabbix config for this org
    const zabbixConfig = await db.query.zabbixConfigs.findFirst({
      where: eq(zabbixConfigs.orgId, org.id),
    });

    // Fetch assets with Zabbix linkage
    const linkedAssets = await db.query.assets.findMany({
      where: eq(assets.orgId, org.id),
      orderBy: (table, { asc }) => [asc(table.name)],
    });

    // Calculate stats
    const zabbixLinkedAssets = linkedAssets.filter(a => a.zabbixHostId);
    const onlineCount = zabbixLinkedAssets.filter(a => a.zabbixTriggers?.length === 0).length;
    const issuesCount = zabbixLinkedAssets.filter(a => a.zabbixTriggers && a.zabbixTriggers.length > 0).length;
    const unmonitoredCount = linkedAssets.filter(a => !a.zabbixHostId).length;

    return (
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Infrastructure</h1>
            <p className="text-sm text-gray-600">
              Monitor your infrastructure via Zabbix integration
            </p>
          </div>
          <div className="flex items-center gap-2">
            {zabbixConfig && (
              <form action={`/api/zabbix/sync?orgId=${org.id}`} method="POST">
                <Button type="submit" variant="outline" className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Sync with Zabbix
                </Button>
              </form>
            )}
            <Link href={`/s/${subdomain}/settings/integrations`}>
              <Button variant="ghost" className="gap-2">
                <Settings className="w-4 h-4" />
                Configure
              </Button>
            </Link>
          </div>
        </div>

        {/* Zabbix Status Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${zabbixConfig ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {zabbixConfig ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <Settings className="w-6 h-6 text-gray-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">
                    {zabbixConfig ? 'Zabbix Connected' : 'Zabbix Not Configured'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {zabbixConfig 
                      ? `Last synced: ${zabbixConfig.lastSyncedAt ? new Date(zabbixConfig.lastSyncedAt).toLocaleString() : 'Never'}`
                      : 'Configure Zabbix integration to monitor your infrastructure'
                    }
                  </p>
                </div>
              </div>
              {!zabbixConfig && (
                <Link href={`/s/${subdomain}/settings/integrations`}>
                  <Button>Configure Zabbix</Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-green-100">
                  <Wifi className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Healthy</p>
                  <p className="text-2xl font-bold">{onlineCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-amber-100">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Issues</p>
                  <p className="text-2xl font-bold">{issuesCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-blue-100">
                  <LinkIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Zabbix Linked</p>
                  <p className="text-2xl font-bold">{zabbixLinkedAssets.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-gray-100">
                  <Server className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Assets</p>
                  <p className="text-2xl font-bold">{linkedAssets.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assets List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Monitored Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            {linkedAssets.length === 0 ? (
              <div className="text-center py-12">
                <Server className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No assets found
                </h3>
                <p className="text-gray-500 max-w-md mx-auto mb-6">
                  No assets have been added to this organization yet.
                </p>
                <Link href={`/s/${subdomain}/assets`}>
                  <Button>Manage Assets</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {linkedAssets.map((asset) => {
                  const hasZabbix = !!asset.zabbixHostId;
                  const hasIssues = asset.zabbixTriggers && asset.zabbixTriggers.length > 0;
                  
                  return (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          hasZabbix 
                            ? hasIssues ? 'bg-amber-100' : 'bg-green-100'
                            : 'bg-gray-100'
                        }`}>
                          {hasZabbix ? (
                            hasIssues ? (
                              <AlertTriangle className="w-5 h-5 text-amber-600" />
                            ) : (
                              <Wifi className="w-5 h-5 text-green-600" />
                            )
                          ) : (
                            <WifiOff className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900">
                              {asset.name}
                            </h3>
                            {hasZabbix ? (
                              hasIssues ? (
                                <Badge className="bg-amber-100 text-amber-700">Issues</Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-700">Healthy</Badge>
                              )
                            ) : (
                              <Badge variant="outline">Unmonitored</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            {asset.hostname && (
                              <span className="font-mono">{asset.hostname}</span>
                            )}
                            {asset.ipAddress && (
                              <span className="font-mono text-gray-400">{asset.ipAddress}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Link href={`/s/${subdomain}/assets/${asset.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  } catch {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Customer admins can view infrastructure monitoring.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
}
