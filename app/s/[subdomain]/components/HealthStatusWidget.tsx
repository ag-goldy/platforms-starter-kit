'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { useCustomerPortal } from '@/components/customer/CustomerPortalContext';

interface HealthStatusWidgetProps {
  subdomain: string;
  org: any;
}

interface ServiceStatus {
  id: string;
  name: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'DOWN';
  uptime24h: number;
  uptime7d: number;
  lastIncident?: string;
}

interface Incident {
  id: string;
  title: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  startedAt: string;
  resolvedAt?: string;
}

export function HealthStatusWidget({ subdomain, org }: HealthStatusWidgetProps) {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const { openSlideOver } = useCustomerPortal();

  useEffect(() => {
    fetchStatusData();
    const interval = setInterval(fetchStatusData, 60000);
    return () => clearInterval(interval);
  }, [org.id]);

  const fetchStatusData = async () => {
    try {
      const res = await fetch(`/api/status/${org.id}`);
      if (res.ok) {
        const data = await res.json();
        setServices(data.services || []);
        setIncidents(data.incidents || []);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  };

  const operationalCount = services.filter((s) => s.status === 'OPERATIONAL').length;
  const degradedCount = services.filter((s) => s.status === 'DEGRADED').length;
  const downCount = services.filter((s) => s.status === 'DOWN').length;

  const overallStatus =
    downCount > 0 ? 'critical' : degradedCount > 0 ? 'warning' : 'operational';

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      OPERATIONAL: 'text-emerald-600 bg-emerald-50',
      DEGRADED: 'text-amber-600 bg-amber-50',
      DOWN: 'text-red-600 bg-red-50',
    };
    return colors[status] || 'text-stone-600 bg-stone-50';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OPERATIONAL':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'DEGRADED':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'DOWN':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-stone-400" />;
    }
  };

  const overallStatusConfig = {
    operational: {
      color: 'bg-emerald-500',
      text: 'All Systems Operational',
      icon: CheckCircle,
    },
    warning: {
      color: 'bg-amber-500',
      text: 'Partial Outage',
      icon: AlertTriangle,
    },
    critical: {
      color: 'bg-red-500',
      text: 'Major Outage',
      icon: XCircle,
    },
  };

  const statusConfig = overallStatusConfig[overallStatus];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          <h3 className="font-semibold text-stone-900">Status</h3>
        </div>
        <div className="flex items-center gap-1">
          {(['24h', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                timeRange === range
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-500 hover:bg-stone-100'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : services.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Activity className="w-8 h-8 text-stone-300 mb-2" />
            <p className="text-xs text-stone-500">No services configured</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Overall Status */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-stone-50">
              <div className={`w-10 h-10 rounded-full ${statusConfig.color} flex items-center justify-center`}>
                <statusConfig.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-sm text-stone-900">{statusConfig.text}</p>
                <p className="text-xs text-stone-500">
                  {operationalCount}/{services.length} services up
                </p>
              </div>
            </div>

            {/* Services List */}
            <div className="space-y-2">
              {services.slice(0, 4).map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-stone-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(service.status)}
                    <span className="text-sm text-stone-700 truncate">{service.name}</span>
                  </div>
                  <span className="text-xs text-stone-500">
                    {timeRange === '24h'
                      ? `${service.uptime24h}%`
                      : timeRange === '7d'
                        ? `${service.uptime7d}%`
                        : '99.9%'}
                  </span>
                </div>
              ))}
            </div>

            {/* Recent Incidents */}
            {incidents.length > 0 && (
              <div className="pt-2 border-t border-stone-100">
                <p className="text-xs font-medium text-stone-500 mb-2">Recent Incidents</p>
                <div className="space-y-2">
                  {incidents.slice(0, 2).map((incident) => (
                    <div
                      key={incident.id}
                      className="flex items-start gap-2 p-2 rounded-lg bg-stone-50"
                    >
                      <Clock className="w-3 h-3 text-stone-400 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-stone-700 truncate">
                          {incident.title}
                        </p>
                        <p className="text-[10px] text-stone-500">
                          {new Date(incident.startedAt).toLocaleDateString()}
                          {incident.resolvedAt && ' • Resolved'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
