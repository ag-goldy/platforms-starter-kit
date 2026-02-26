import { notFound } from 'next/navigation';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { getServicesByOrg } from '@/lib/services/queries';
import { getMonitoringHistory } from '@/lib/zabbix/queries';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, TrendingUp, Clock, AlertCircle, Server } from 'lucide-react';
import { ServicesRefresh } from '@/components/customer/services-refresh';
import { Button } from '@/components/ui/button';

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
      <ServicesRefresh refreshInterval={60000}>
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-in fade-in-0 slide-in-from-top-2 duration-300">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm">
                <Server className="h-3.5 w-3.5 text-orange-600" />
                Monitoring & Coverage
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
                Services
              </h1>
              <p className="text-sm md:text-base text-gray-600">
                Live health, uptime, and alerts for your supported services
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link href={`/s/${subdomain}/status`}>
                <Button variant="outline" className="border-gray-200 hover:bg-gray-50">
                  View status
                </Button>
              </Link>
              <Link href={`/s/${subdomain}/tickets/new`}>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                  Report an issue
                </Button>
              </Link>
            </div>
          </div>

        {/* Overall Status Summary */}
        {monitoredServices.length > 0 && (
          <Card className={`rounded-3xl border shadow-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-150 ${
            criticalCount > 0
              ? 'border-red-200 bg-red-50'
              : degradedCount > 0
                ? 'border-yellow-200 bg-yellow-50'
                : 'border-green-200 bg-green-50'
          }`}>
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900">
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
                <div className="sm:text-right">
                  <div className="text-3xl font-bold text-gray-900 leading-none">
                    {monitoredServices.length > 0 
                      ? Math.round((operationalCount / monitoredServices.length) * 100) 
                      : 100}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Uptime (24h)</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Services List */}
        <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-200">
          {servicesWithHistory.length === 0 ? (
            <p className="text-sm text-gray-600">No services available.</p>
          ) : (
            servicesWithHistory.map((svc) => (
              <Card key={svc.id} className="overflow-hidden rounded-3xl border-gray-100 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="p-5 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-semibold text-lg text-gray-900">{svc.name}</h3>
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
                        <p className="text-sm text-gray-600 mt-2">{svc.description}</p>
                      )}

                      {/* Monitoring Metrics */}
                      {svc.monitoringEnabled && svc.monitoringStatus !== 'ERROR' && (
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-4">
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
                              <div key={idx} className="flex items-center gap-2 text-sm text-red-700">
                                <AlertCircle className="h-4 w-4" />
                                <span>{trigger.description}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    <Link 
                      href={`/s/${subdomain}/tickets/new?serviceId=${svc.id}`}
                      className="shrink-0 text-sm font-medium text-orange-700 hover:text-orange-800 hover:underline whitespace-nowrap"
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
        <div className="text-xs text-gray-500 pt-4 border-t border-gray-100 animate-in fade-in-0 duration-300 delay-300">
          <p>Status indicators show real-time monitoring data from our infrastructure monitoring system.</p>
        </div>
      </div>
      </ServicesRefresh>
    );
  } catch {
    return (
      <div className="mx-auto max-w-md py-12">
        <p className="text-sm text-gray-600">Please sign in to view services.</p>
      </div>
    );
  }
}
