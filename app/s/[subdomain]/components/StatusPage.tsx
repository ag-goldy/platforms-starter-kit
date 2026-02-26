'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  ExternalLink,
  Link,
  Server,
  Database,
  Cloud,
  Shield,
  Wifi,
  RefreshCw,
  Calendar,
  ChevronRight,
} from 'lucide-react';

interface StatusPageProps {
  subdomain: string;
  org: any;
}

interface ServiceStatus {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'outage' | 'maintenance';
  description?: string;
  uptime24h: number;
  uptime7d: number;
  uptime30d: number;
  externalUrl?: string;
}

interface Incident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  serviceId: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  updates: IncidentUpdate[];
}

interface IncidentUpdate {
  id: string;
  message: string;
  status: string;
  createdAt: string;
}

interface ExternalIntegration {
  id: string;
  name: string;
  type: 'zabbix' | 'datadog' | 'grafana' | 'custom';
  url: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSyncAt?: string;
}

export function StatusPage({ subdomain, org }: StatusPageProps) {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [integrations, setIntegrations] = useState<ExternalIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');

  useEffect(() => {
    fetchStatusData();
  }, [org.id]);

  const fetchStatusData = async () => {
    try {
      // Fetch services
      const servicesRes = await fetch(`/api/services/org/${org.id}`);
      if (servicesRes.ok) {
        const servicesData = await servicesRes.json();
        setServices(servicesData.services || []);
      }

      // Fetch incidents
      const incidentsRes = await fetch(`/api/status/${org.id}/incidents`);
      if (incidentsRes.ok) {
        const incidentsData = await incidentsRes.json();
        setIncidents(incidentsData.incidents || []);
      }

      // Fetch external integrations
      const integrationsRes = await fetch(`/api/integrations/${org.id}`);
      if (integrationsRes.ok) {
        const integrationsData = await integrationsRes.json();
        setIntegrations(integrationsData.integrations || []);
      }
    } catch (error) {
      console.error('Failed to fetch status data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOverallStatus = () => {
    if (services.some((s) => s.status === 'outage')) return 'outage';
    if (services.some((s) => s.status === 'degraded')) return 'degraded';
    if (services.some((s) => s.status === 'maintenance')) return 'maintenance';
    return 'operational';
  };

  const overallStatus = getOverallStatus();

  const statusConfig = {
    operational: {
      icon: CheckCircle,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      label: 'All Systems Operational',
      description: 'All services are running normally',
    },
    degraded: {
      icon: AlertTriangle,
      color: 'text-amber-500',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      label: 'Partial Degradation',
      description: 'Some services are experiencing issues',
    },
    outage: {
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      label: 'Major Outage',
      description: 'Critical services are down',
    },
    maintenance: {
      icon: Clock,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      label: 'Scheduled Maintenance',
      description: 'Services are undergoing maintenance',
    },
  };

  const config = statusConfig[overallStatus];
  const StatusIcon = config.icon;

  const getServiceIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('database') || lower.includes('db')) return <Database className="w-5 h-5" />;
    if (lower.includes('cloud') || lower.includes('api')) return <Cloud className="w-5 h-5" />;
    if (lower.includes('security') || lower.includes('auth')) return <Shield className="w-5 h-5" />;
    if (lower.includes('network') || lower.includes('cdn')) return <Wifi className="w-5 h-5" />;
    return <Server className="w-5 h-5" />;
  };

  const getServiceStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'text-emerald-500 bg-emerald-50';
      case 'degraded':
        return 'text-amber-500 bg-amber-50';
      case 'outage':
        return 'text-red-500 bg-red-50';
      case 'maintenance':
        return 'text-blue-500 bg-blue-50';
      default:
        return 'text-stone-500 bg-stone-50';
    }
  };

  const getUptime = (service: ServiceStatus) => {
    switch (timeRange) {
      case '24h':
        return service.uptime24h;
      case '7d':
        return service.uptime7d;
      case '30d':
        return service.uptime30d;
      default:
        return service.uptime7d;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Overall Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-6 rounded-2xl border ${config.bgColor} ${config.borderColor}`}
      >
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl bg-white flex items-center justify-center ${config.color}`}>
            <StatusIcon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-stone-900">{config.label}</h1>
            <p className="text-stone-600 mt-1">{config.description}</p>
            <p className="text-sm text-stone-500 mt-2">
              Last updated: {new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </motion.div>

      {/* External Integrations */}
      {integrations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-surface-elevated rounded-2xl border border-stone-200 p-6"
        >
          <h2 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <Link className="w-5 h-5 text-brand-500" />
            External Integrations
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {integrations.map((integration) => (
              <a
                key={integration.id}
                href={integration.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors group"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    integration.status === 'connected'
                      ? 'bg-emerald-100 text-emerald-600'
                      : integration.status === 'error'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-stone-200 text-stone-500'
                  }`}
                >
                  {integration.type === 'zabbix' && <Server className="w-5 h-5" />}
                  {integration.type === 'datadog' && <Activity className="w-5 h-5" />}
                  {integration.type === 'grafana' && <BarChart3 className="w-5 h-5" />}
                  {integration.type === 'custom' && <Link className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-stone-900">{integration.name}</p>
                  <p className="text-xs text-stone-500 capitalize">{integration.status}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-stone-400 group-hover:text-stone-600" />
              </a>
            ))}
          </div>
        </motion.div>
      )}

      {/* Services */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-surface-elevated rounded-2xl border border-stone-200 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">Services</h2>
          <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1">
            {(['24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-stone-100">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : services.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center p-6">
              <Server className="w-8 h-8 text-stone-300 mb-2" />
              <p className="text-sm text-stone-500">No services configured</p>
            </div>
          ) : (
            services.map((service) => (
              <div
                key={service.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600">
                  {getServiceIcon(service.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-stone-900">{service.name}</p>
                    {service.externalUrl && (
                      <a
                        href={service.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-stone-400 hover:text-brand-600"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  {service.description && (
                    <p className="text-sm text-stone-500 truncate">{service.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getServiceStatusColor(
                      service.status
                    )}`}
                  >
                    {service.status === 'operational' && <CheckCircle className="w-3 h-3" />}
                    {service.status === 'degraded' && <AlertTriangle className="w-3 h-3" />}
                    {service.status === 'outage' && <XCircle className="w-3 h-3" />}
                    {service.status === 'maintenance' && <Clock className="w-3 h-3" />}
                    <span className="capitalize">{service.status}</span>
                  </span>
                  <p className="text-xs text-stone-400 mt-1">{getUptime(service)}% uptime</p>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>

      {/* Incident History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-surface-elevated rounded-2xl border border-stone-200 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-stone-100">
          <h2 className="text-lg font-semibold text-stone-900">Incident History</h2>
        </div>

        <div className="divide-y divide-stone-100">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center p-6">
              <Calendar className="w-8 h-8 text-stone-300 mb-2" />
              <p className="text-sm text-stone-500">No incidents in the last 90 days</p>
            </div>
          ) : (
            incidents.map((incident) => (
              <div key={incident.id} className="px-6 py-4 hover:bg-stone-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-2 ${
                      incident.severity === 'critical'
                        ? 'bg-red-500'
                        : incident.severity === 'major'
                        ? 'bg-orange-500'
                        : 'bg-amber-500'
                    }`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-stone-900">{incident.title}</p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          incident.status === 'resolved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {incident.status}
                      </span>
                    </div>
                    <p className="text-sm text-stone-500 mt-1">
                      {new Date(incident.createdAt).toLocaleDateString()} •{' '}
                      {services.find((s) => s.id === incident.serviceId)?.name || 'Unknown service'}
                    </p>
                    {incident.updates.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {incident.updates.slice(0, 2).map((update) => (
                          <div key={update.id} className="text-sm text-stone-600 pl-3 border-l-2 border-stone-200">
                            <p>{update.message}</p>
                            <p className="text-xs text-stone-400 mt-1">
                              {new Date(update.createdAt).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>

      {/* Uptime History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-surface-elevated rounded-2xl border border-stone-200 p-6"
      >
        <h2 className="text-lg font-semibold text-stone-900 mb-4">Uptime History</h2>
        <div className="flex items-end gap-1 h-24">
          {Array.from({ length: 30 }).map((_, i) => {
            const height = Math.random() * 80 + 20;
            const isOperational = Math.random() > 0.1;
            return (
              <div
                key={i}
                className={`flex-1 rounded-t ${isOperational ? 'bg-emerald-400' : 'bg-red-400'}`}
                style={{ height: `${height}%` }}
                title={`Day ${i + 1}: ${isOperational ? 'Operational' : 'Incident'}`}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-xs text-stone-400">
          <span>30 days ago</span>
          <span>Today</span>
        </div>
      </motion.div>
    </div>
  );
}
