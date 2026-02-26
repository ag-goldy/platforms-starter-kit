import { notFound, redirect } from 'next/navigation';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { services, serviceMonitoringHistory, zabbixConfigs } from '@/db/schema';
import { eq, desc, gte } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils/date';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Activity,
  Server,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

export const metadata = {
  title: 'Service Status',
};

interface StatusPageProps {
  params: Promise<{ subdomain: string }>;
}

export default async function ServiceStatusPage({ params }: StatusPageProps) {
  const { subdomain } = await params;
  const org = await getOrgBySubdomain(subdomain);

  if (!org) {
    notFound();
  }

  // Require authentication
  try {
    await requireOrgMemberRole(org.id);
  } catch {
    redirect(`/login?callbackUrl=/s/${subdomain}/status`);
  }

  // Get services for this org
  const orgServices = await db.query.services.findMany({
    where: eq(services.orgId, org.id),
    orderBy: [desc(services.createdAt)],
  });

  // Get Zabbix config
  const zabbixConfig = await db.query.zabbixConfigs.findFirst({
    where: eq(zabbixConfigs.orgId, org.id),
  });

  // Get monitoring history for the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const serviceIds = orgServices.map(s => s.id);
  const monitoringHistory = serviceIds.length > 0
    ? await db
        .select()
        .from(serviceMonitoringHistory)
        .where(gte(serviceMonitoringHistory.timestamp, thirtyDaysAgo))
        .orderBy(desc(serviceMonitoringHistory.timestamp))
        .limit(100)
    : [];

  // Calculate overall status
  const activeServices = orgServices.filter(s => s.status === 'ACTIVE');
  const servicesWithMonitoring = activeServices.filter(s => s.monitoringStatus);
  
  const upServices = servicesWithMonitoring.filter(
    s => s.monitoringStatus === 'UP' || s.monitoringStatus === 'OK'
  ).length;
  
  const downServices = servicesWithMonitoring.filter(
    s => s.monitoringStatus === 'DOWN' || s.monitoringStatus === 'PROBLEM'
  ).length;

  const unknownServices = servicesWithMonitoring.filter(
    s => !['UP', 'OK', 'DOWN', 'PROBLEM'].includes(s.monitoringStatus || '')
  ).length;

  // Calculate uptime percentage
  const totalChecks = monitoringHistory.length;
  const upChecks = monitoringHistory.filter(
    h => h.status === 'UP' || h.status === 'OK'
  ).length;
  const uptimePercentage = totalChecks > 0 ? (upChecks / totalChecks) * 100 : 100;

  // Get recent incidents
  const recentIncidents = monitoringHistory
    .filter(h => h.status === 'DOWN' || h.status === 'PROBLEM')
    .slice(0, 5);

  const hasMonitoring = !!zabbixConfig && zabbixConfig.isActive;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-in fade-in-0 slide-in-from-top-2 duration-300">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-30 animate-ping ${
                  downServices > 0
                    ? 'bg-red-500'
                    : unknownServices > 0
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                }`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  downServices > 0
                    ? 'bg-red-500'
                    : unknownServices > 0
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                }`}
              />
            </span>
            Live status
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
            {org.name} Service Status
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            Real-time status of our services and infrastructure
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock className="h-4 w-4" />
            <span>Last updated: {formatDateTime(new Date())}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/s/${subdomain}/tickets/new`}>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                Report an issue
              </Button>
            </Link>
            <Link href={`/s/${subdomain}/services`}>
              <Button variant="outline" className="border-gray-200 hover:bg-gray-50">
                View services
              </Button>
            </Link>
          </div>
        </div>
      </div>

        {/* Overall Status */}
        <Card className={`rounded-3xl border shadow-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-150 ${
          downServices > 0 
            ? 'border-red-200 bg-red-50' 
            : unknownServices > 0 
              ? 'border-yellow-200 bg-yellow-50' 
              : 'border-green-200 bg-green-50'
        }`}>
          <CardContent className="p-6 md:p-8">
            <div className="flex items-center gap-4">
              {downServices > 0 ? (
                <XCircle className="h-12 w-12 text-red-600" />
              ) : unknownServices > 0 ? (
                <AlertCircle className="h-12 w-12 text-yellow-600" />
              ) : (
                <CheckCircle className="h-12 w-12 text-green-600" />
              )}
              <div>
                <h2 className="text-xl font-semibold">
                  {downServices > 0 
                    ? 'Some Systems Experiencing Issues' 
                    : unknownServices > 0 
                      ? 'Partial System Status Available'
                      : 'All Systems Operational'
                  }
                </h2>
                <p className="text-gray-600">
                  {upServices} of {servicesWithMonitoring.length} monitored services are up
                  {hasMonitoring && ` • ${uptimePercentage.toFixed(2)}% uptime (30 days)`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-200">
          <Card className="rounded-2xl border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-xl">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Operational</p>
                  <p className="text-2xl font-bold text-gray-900">{upServices}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-xl">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Down</p>
                  <p className="text-2xl font-bold text-gray-900">{downServices}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">30-Day Uptime</p>
                  <p className="text-2xl font-bold text-gray-900">{uptimePercentage.toFixed(2)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-xl">
                  <Server className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Services</p>
                  <p className="text-2xl font-bold text-gray-900">{orgServices.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Services Status */}
        <Card className="rounded-3xl border-gray-100 shadow-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-300">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5" />
              Service Status
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {orgServices.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No services configured yet.
              </p>
            ) : (
              <div className="space-y-3">
                {orgServices.map((service) => {
                  const status = getServiceDisplayStatus(service);
                  return (
                    <div 
                      key={service.id} 
                      className="group flex items-start justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        {status.icon}
                        <div>
                          <h3 className="font-medium">{service.name}</h3>
                          {service.description && (
                            <p className="text-sm text-gray-500">{service.description}</p>
                          )}
                          {service.zabbixHostName && (
                            <p className="text-xs text-gray-400">
                              Monitored via: {service.zabbixHostName}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={status.badgeClass}
                      >
                        {status.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Incidents */}
        <Card className="rounded-3xl border-gray-100 shadow-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5" />
              Recent Incidents
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {recentIncidents.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto text-green-400 mb-3" />
                <p className="text-gray-500">No incidents in the last 30 days</p>
                <p className="text-sm text-gray-400 mt-1">
                  Great job! Everything has been running smoothly.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentIncidents.map((incident, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-lg"
                  >
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-red-900">
                        Service Alert
                      </p>
                      <p className="text-sm text-red-700">
                        Status: {incident.status}
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        {formatDateTime(incident.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 pt-2 animate-in fade-in-0 duration-300 delay-700">
          <p>
            Powered by Zabbix Integration
            {hasMonitoring 
              ? ' • Monitoring Active' 
              : ' • Monitoring Not Configured'}
          </p>
        </div>
    </div>
  );
}

function getServiceDisplayStatus(service: {
  status: string;
  monitoringStatus: string | null;
}) {
  if (service.status === 'INACTIVE') {
    return {
      icon: <Clock className="h-5 w-5 text-gray-400" />,
      label: 'Inactive',
      badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
    };
  }

  switch (service.monitoringStatus) {
    case 'UP':
    case 'OK':
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-500" />,
        label: 'Operational',
        badgeClass: 'bg-green-100 text-green-700 border-green-200',
      };
    case 'DOWN':
    case 'PROBLEM':
      return {
        icon: <XCircle className="h-5 w-5 text-red-500" />,
        label: 'Down',
        badgeClass: 'bg-red-100 text-red-700 border-red-200',
      };
    default:
      return {
        icon: <AlertCircle className="h-5 w-5 text-yellow-500" />,
        label: 'Unknown',
        badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      };
  }
}
