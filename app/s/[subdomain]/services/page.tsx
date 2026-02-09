import { notFound } from 'next/navigation';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { getServicesByOrg } from '@/lib/services/queries';
import { getMonitoringHistory } from '@/lib/zabbix/queries';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, TrendingUp, Clock, AlertCircle } from 'lucide-react';

interface ServiceWithMonitoring {
  id: string;
  name: string;
  description: string | null;
  status: string;
  isUnderContract: boolean;
  monitoringEnabled: boolean | null;
  monitoringStatus: string | null;
  uptimePercentage: string | null;
  responseTimeMs: number | null;
  zabbixTriggers: unknown[] | null;
  lastSyncedAt: Date | null;
}

function getStatusColor(status: string | null): string {
  switch (status) {
    case 'OPERATIONAL':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'DEGRADED':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'CRITICAL':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'MINOR_ISSUES':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'ERROR':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getStatusIcon(status: string | null) {
  switch (status) {
    case 'OPERATIONAL':
      return <Activity className="h-4 w-4 text-green-600" />;
    case 'DEGRADED':
    case 'MINOR_ISSUES':
      return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    case 'CRITICAL':
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Activity className="h-4 w-4 text-gray-400" />;
  }
}

function getStatusLabel(status: string | null): string {
  switch (status) {
    case 'OPERATIONAL':
      return 'Operational';
    case 'DEGRADED':
      return 'Degraded';
    case 'CRITICAL':
      return 'Critical';
    case 'MINOR_ISSUES':
      return 'Minor Issues';
    case 'ERROR':
      return 'Error';
    default:
      return 'Unknown';
  }
}

export default async function CustomerServicesPage({
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
    await requireOrgMemberRole(org.id);
    const items = await getServicesByOrg(org.id) as ServiceWithMonitoring[];
    
    // Get monitoring history for each service
    const servicesWithHistory = await Promise.all(
      items.map(async (service) => {
        const history = await getMonitoringHistory(service.id, 24);
        return { ...service, history };
      })
    );

    // Calculate overall status
    const monitoredServices = servicesWithHistory.filter(s => s.monitoringEnabled);
    const criticalCount = monitoredServices.filter(s => s.monitoringStatus === 'CRITICAL').length;
    const degradedCount = monitoredServices.filter(s => s.monitoringStatus === 'DEGRADED').length;
    const operationalCount = monitoredServices.filter(s => s.monitoringStatus === 'OPERATIONAL').length;

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Services</h1>
          <Link 
            href={`/s/${subdomain}/tickets/new`}
            className="text-sm text-primary hover:underline"
          >
            Report an Issue
          </Link>
        </div>

        {/* Overall Status Summary */}
        {monitoredServices.length > 0 && (
          <Card className={criticalCount > 0 ? 'border-red-200 bg-red-50' : degradedCount > 0 ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50'}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <h2 className="font-semibold">
                    {criticalCount > 0 
                      ? 'Some services are experiencing issues' 
                      : degradedCount > 0 
                        ? 'Some services are degraded'
                        : 'All services operational'}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {operationalCount} operational, {degradedCount} degraded, {criticalCount} critical
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {monitoredServices.length > 0 
                      ? Math.round((operationalCount / monitoredServices.length) * 100) 
                      : 100}%
                  </div>
                  <div className="text-xs text-gray-500">Uptime</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Services List */}
        <div className="space-y-3">
          {servicesWithHistory.length === 0 ? (
            <p className="text-sm text-gray-600">No services available.</p>
          ) : (
            servicesWithHistory.map((svc) => (
              <Card key={svc.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{svc.name}</h3>
                        {svc.monitoringEnabled ? (
                          <Badge className={getStatusColor(svc.monitoringStatus)} variant="outline">
                            <span className="flex items-center gap-1">
                              {getStatusIcon(svc.monitoringStatus)}
                              {getStatusLabel(svc.monitoringStatus)}
                            </span>
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-100 text-gray-600">
                            <Activity className="h-3 w-3 mr-1" />
                            Not Monitored
                          </Badge>
                        )}
                        {svc.isUnderContract && (
                          <Badge variant="secondary">Managed</Badge>
                        )}
                      </div>
                      
                      {svc.description && (
                        <p className="text-sm text-gray-600 mb-3">{svc.description}</p>
                      )}

                      {/* Monitoring Metrics */}
                      {svc.monitoringEnabled && svc.monitoringStatus !== 'ERROR' && (
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-3">
                          {svc.uptimePercentage && (
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4 text-green-600" />
                              <span>{parseFloat(svc.uptimePercentage).toFixed(2)}% uptime</span>
                            </div>
                          )}
                          {svc.responseTimeMs && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-blue-600" />
                              <span>{svc.responseTimeMs}ms response</span>
                            </div>
                          )}
                          {svc.lastSyncedAt && (
                            <div className="text-xs text-gray-400">
                              Updated {new Date(svc.lastSyncedAt).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Active Alerts */}
                      {svc.zabbixTriggers && Array.isArray(svc.zabbixTriggers) && svc.zabbixTriggers.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {svc.zabbixTriggers
                            .filter((t: any) => t.value === '1')
                            .slice(0, 3)
                            .map((trigger: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 text-sm text-red-600">
                                <AlertCircle className="h-4 w-4" />
                                <span>{trigger.description}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    <Link 
                      href={`/s/${subdomain}/tickets/new?serviceId=${svc.id}`}
                      className="shrink-0 text-sm text-primary hover:underline whitespace-nowrap"
                    >
                      Create ticket
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Legend */}
        <div className="text-xs text-gray-500 pt-4 border-t">
          <p>Status indicators show real-time monitoring data from our infrastructure monitoring system.</p>
        </div>
      </div>
    );
  } catch {
    return (
      <div className="mx-auto max-w-md py-12">
        <p className="text-sm text-gray-600">Please sign in to view services.</p>
      </div>
    );
  }
}
