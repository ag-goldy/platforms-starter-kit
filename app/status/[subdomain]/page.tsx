/**
 * Public Status Page
 * 
 * A publicly accessible status page for each organization.
 * No authentication required - shows service status and incidents.
 * 
 * URL: status.agrnetworks.com/[subdomain] or atlas.agrnetworks.com/status/[subdomain]
 */

import { notFound } from 'next/navigation';
import { db } from '@/db';
import { organizations, services, serviceMonitoringHistory } from '@/db/schema';
import { eq, desc, gte } from 'drizzle-orm';
import { formatDateTime, formatDuration } from '@/lib/utils/date';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock,
  RefreshCw,
  Calendar,
  Activity,
  TrendingUp,
  ExternalLink
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Revalidate every 5 minutes (300 seconds)
export const revalidate = 300;

interface StatusPageProps {
  params: Promise<{ subdomain: string }>;
}

export async function generateMetadata({ params }: StatusPageProps) {
  const { subdomain } = await params;
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.subdomain, subdomain),
  });

  return {
    title: org ? `${org.name} Status` : 'Status Page',
    description: org ? `Real-time status of ${org.name} services` : 'Service status page',
  };
}

export default async function PublicStatusPage({ params }: StatusPageProps) {
  const { subdomain } = await params;

  // Get organization
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.subdomain, subdomain),
  });

  if (!org) {
    notFound();
  }

  // Get all services for this org
  const orgServices = await db.query.services.findMany({
    where: eq(services.orgId, org.id),
    orderBy: [desc(services.createdAt)],
  });

  // Get monitoring history for last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const monitoringHistory = await db.query.serviceMonitoringHistory.findMany({
    where: gte(serviceMonitoringHistory.timestamp, thirtyDaysAgo),
    orderBy: [desc(serviceMonitoringHistory.timestamp)],
    limit: 1000,
  });

  // Calculate overall status
  const activeServices = orgServices.filter(s => s.status === 'ACTIVE');
  const monitoredServices = activeServices.filter(s => s.monitoringStatus);
  
  const downServices = monitoredServices.filter(
    s => s.monitoringStatus === 'DOWN' || s.monitoringStatus === 'PROBLEM'
  );
  
  const degradedServices = monitoredServices.filter(
    s => s.monitoringStatus === 'DEGRADED'
  );

  // Calculate overall status
  let overallStatus: 'operational' | 'degraded' | 'major_outage' = 'operational';
  if (downServices.length > 0) {
    overallStatus = 'major_outage';
  } else if (degradedServices.length > 0) {
    overallStatus = 'degraded';
  }

  // Calculate uptime percentage (30 days)
  const totalChecks = monitoringHistory.length;
  const upChecks = monitoringHistory.filter(
    h => h.status === 'UP' || h.status === 'OK' || h.status === 'OPERATIONAL'
  ).length;
  const uptimePercentage = totalChecks > 0 ? (upChecks / totalChecks) * 100 : 100;

  // Get recent incidents (last 10)
  const recentIncidents = monitoringHistory
    .filter(h => h.status === 'DOWN' || h.status === 'PROBLEM' || h.alertsCount > 0)
    .slice(0, 10);

  // Get org branding
  const branding = org.branding || {};
  const primaryColor = branding.primaryColor || '#f97316'; // Default orange

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {branding.logoUrl ? (
                <img 
                  src={branding.logoUrl} 
                  alt={org.name}
                  className="h-10 w-auto"
                />
              ) : (
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                  style={{ backgroundColor: primaryColor }}
                >
                  {org.name.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
                <p className="text-sm text-gray-500">Service Status</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <RefreshCw className="w-4 h-4" />
              <span>Updated {formatDateTime(new Date())}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overall Status Banner */}
        <div className={`
          rounded-2xl p-8 mb-8 text-center
          ${overallStatus === 'operational' ? 'bg-green-50 border-2 border-green-200' : ''}
          ${overallStatus === 'degraded' ? 'bg-yellow-50 border-2 border-yellow-200' : ''}
          ${overallStatus === 'major_outage' ? 'bg-red-50 border-2 border-red-200' : ''}
        `}>
          <div className="flex items-center justify-center gap-3 mb-4">
            {overallStatus === 'operational' && (
              <>
                <CheckCircle className="w-12 h-12 text-green-600" />
                <h2 className="text-3xl font-bold text-green-800">All Systems Operational</h2>
              </>
            )}
            {overallStatus === 'degraded' && (
              <>
                <AlertTriangle className="w-12 h-12 text-yellow-600" />
                <h2 className="text-3xl font-bold text-yellow-800">Partial System Degradation</h2>
              </>
            )}
            {overallStatus === 'major_outage' && (
              <>
                <XCircle className="w-12 h-12 text-red-600" />
                <h2 className="text-3xl font-bold text-red-800">Major Service Outage</h2>
              </>
            )}
          </div>
          <p className="text-gray-600">
            {monitoredServices.length > 0 
              ? `${monitoredServices.length - downServices.length - degradedServices.length} of ${monitoredServices.length} monitored services are up`
              : 'No services currently monitored'
            }
            {monitoredServices.length > 0 && ` • ${uptimePercentage.toFixed(2)}% uptime (30 days)`}
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<CheckCircle className="w-5 h-5 text-green-600" />}
            label="Operational"
            value={monitoredServices.length - downServices.length - degradedServices.length}
            bgColor="bg-green-50"
          />
          <StatCard
            icon={<AlertTriangle className="w-5 h-5 text-yellow-600" />}
            label="Degraded"
            value={degradedServices.length}
            bgColor="bg-yellow-50"
          />
          <StatCard
            icon={<XCircle className="w-5 h-5 text-red-600" />}
            label="Down"
            value={downServices.length}
            bgColor="bg-red-50"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
            label="30-Day Uptime"
            value={`${uptimePercentage.toFixed(2)}%`}
            bgColor="bg-blue-50"
          />
        </div>

        {/* Services Status */}
        <section className="bg-white rounded-2xl shadow-sm border mb-8">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Service Status
            </h3>
          </div>
          <div className="divide-y">
            {orgServices.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No services configured yet.</p>
              </div>
            ) : (
              orgServices.map((service) => (
                <ServiceStatusRow key={service.id} service={service} />
              ))
            )}
          </div>
        </section>

        {/* Recent Incidents */}
        <section className="bg-white rounded-2xl shadow-sm border mb-8">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Recent Incidents
            </h3>
          </div>
          <div className="divide-y">
            {recentIncidents.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-3" />
                <p className="text-gray-500">No incidents in the last 30 days</p>
                <p className="text-sm text-gray-400 mt-1">
                  Great job! Everything has been running smoothly.
                </p>
              </div>
            ) : (
              recentIncidents.map((incident, index) => (
                <IncidentRow key={index} incident={incident} />
              ))
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-sm text-gray-500 py-8 border-t">
          <p className="mb-2">
            Powered by Atlas Helpdesk
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href={`/s/${subdomain}`}>
              <Button variant="link" size="sm" className="text-gray-500">
                <ExternalLink className="w-4 h-4 mr-1" />
                Customer Portal
              </Button>
            </Link>
            <span>•</span>
            <Link href={`/s/${subdomain}/kb`}>
              <Button variant="link" size="sm" className="text-gray-500">
                Knowledge Base
              </Button>
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  bgColor 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number;
  bgColor: string;
}) {
  return (
    <div className={`${bgColor} rounded-xl p-4 border`}>
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-sm font-medium text-gray-600">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function ServiceStatusRow({ service }: { service: typeof services.$inferSelect }) {
  const getStatusConfig = (status: string | null) => {
    switch (status) {
      case 'UP':
      case 'OK':
      case 'OPERATIONAL':
        return {
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
          label: 'Operational',
          badgeClass: 'bg-green-100 text-green-700 border-green-200',
        };
      case 'DEGRADED':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
          label: 'Degraded',
          badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        };
      case 'DOWN':
      case 'PROBLEM':
        return {
          icon: <XCircle className="w-5 h-5 text-red-500" />,
          label: 'Major Outage',
          badgeClass: 'bg-red-100 text-red-700 border-red-200',
        };
      default:
        return {
          icon: <Clock className="w-5 h-5 text-gray-400" />,
          label: 'Unknown',
          badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
        };
    }
  };

  const config = getStatusConfig(service.monitoringStatus);

  return (
    <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3">
        {config.icon}
        <div>
          <h4 className="font-medium text-gray-900">{service.name}</h4>
          {service.description && (
            <p className="text-sm text-gray-500">{service.description}</p>
          )}
          {service.zabbixHostName && (
            <p className="text-xs text-gray-400">
              Monitored: {service.zabbixHostName}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {service.uptimePercentage && (
          <span className="text-sm text-gray-500 hidden sm:inline">
            {parseFloat(service.uptimePercentage).toFixed(1)}% uptime
          </span>
        )}
        <Badge variant="outline" className={config.badgeClass}>
          {config.label}
        </Badge>
      </div>
    </div>
  );
}

function IncidentRow({ incident }: { incident: typeof serviceMonitoringHistory.$inferSelect }) {
  const duration = incident.timestamp && new Date(incident.timestamp).getTime() 
    ? formatDuration(Math.floor((Date.now() - new Date(incident.timestamp).getTime()) / 60000))
    : 'Unknown';

  return (
    <div className="p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors">
      <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-medium text-gray-900">
            Service Alert
          </h4>
          <Badge variant="outline" className="text-xs">
            {incident.status}
          </Badge>
        </div>
        <p className="text-sm text-gray-600 mb-1">
          {incident.alertsCount && incident.alertsCount > 0 
            ? `${incident.alertsCount} alert(s) triggered`
            : 'Status change detected'
          }
        </p>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{formatDateTime(incident.timestamp)}</span>
          <span>•</span>
          <span>{duration} ago</span>
          {incident.uptimePercentage && (
            <>
              <span>•</span>
              <span>Uptime: {parseFloat(incident.uptimePercentage).toFixed(1)}%</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
