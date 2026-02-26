'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Server,
  Wifi,
  Router,
  Video,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  Link,
  ExternalLink,
  Search,
  Filter,
  BarChart3,
  MapPin,
  Cpu,
  HardDrive,
} from 'lucide-react';

interface InfrastructureSlideOverProps {
  subdomain: string;
  org: any;
  onClose: () => void;
}

interface ZabbixHost {
  id: string;
  hostid: string;
  name: string;
  host: string;
  status: string;
  available: string;
  ip: string;
  type: string;
  group: string;
  location?: string;
  items: ZabbixItem[];
  triggers: ZabbixTrigger[];
}

interface ZabbixItem {
  itemid: string;
  name: string;
  lastvalue: string;
  units: string;
  lastclock: string;
}

interface ZabbixTrigger {
  triggerid: string;
  description: string;
  priority: string;
  value: string;
  lastchange: string;
}

interface ZabbixIntegration {
  enabled: boolean;
  url: string;
  username: string;
  lastSyncAt?: string;
  syncStatus: 'idle' | 'syncing' | 'error';
}

export function InfrastructureSlideOver({ subdomain, org, onClose }: InfrastructureSlideOverProps) {
  const [hosts, setHosts] = useState<ZabbixHost[]>([]);
  const [integration, setIntegration] = useState<ZabbixIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHost, setSelectedHost] = useState<ZabbixHost | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline' | 'issues'>('all');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchInfrastructureData();
  }, [org.id]);

  const fetchInfrastructureData = async () => {
    try {
      // Check if Zabbix integration exists
      const integrationRes = await fetch(`/api/zabbix/integration/${org.id}`);
      if (integrationRes.ok) {
        const integrationData = await integrationRes.json();
        setIntegration(integrationData);

        if (integrationData.enabled) {
          // Fetch hosts from Zabbix
          const hostsRes = await fetch(`/api/zabbix/hosts/${org.id}`);
          if (hostsRes.ok) {
            const hostsData = await hostsRes.json();
            setHosts(hostsData.hosts || []);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch infrastructure data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/zabbix/sync/${org.id}`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchInfrastructureData();
      }
    } catch (error) {
      console.error('Failed to sync:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const getHostIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'AP':
        return <Wifi className="w-5 h-5" />;
      case 'SWITCH':
      case 'ROUTER':
        return <Router className="w-5 h-5" />;
      case 'CAMERA':
      case 'NVR':
        return <Video className="w-5 h-5" />;
      case 'FIREWALL':
        return <Shield className="w-5 h-5" />;
      case 'SERVER':
        return <Server className="w-5 h-5" />;
      default:
        return <Server className="w-5 h-5" />;
    }
  };

  const getHostStatus = (host: ZabbixHost) => {
    const hasTriggers = host.triggers?.some((t) => t.value === '1');
    const isAvailable = host.available === '1';

    if (!isAvailable) return 'offline';
    if (hasTriggers) return 'issues';
    return 'online';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-500';
      case 'issues':
        return 'bg-amber-500';
      case 'offline':
        return 'bg-red-500';
      default:
        return 'bg-stone-400';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-50 border-emerald-200';
      case 'issues':
        return 'bg-amber-50 border-amber-200';
      case 'offline':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-stone-50 border-stone-200';
    }
  };

  const filteredHosts = hosts.filter((host) => {
    const matchesSearch =
      host.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      host.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
      host.ip?.includes(searchQuery);

    const status = getHostStatus(host);
    const matchesFilter = filterStatus === 'all' || status === filterStatus;

    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: hosts.length,
    online: hosts.filter((h) => getHostStatus(h) === 'online').length,
    issues: hosts.filter((h) => getHostStatus(h) === 'issues').length,
    offline: hosts.filter((h) => getHostStatus(h) === 'offline').length,
  };

  // Host Detail View
  if (selectedHost) {
    const status = getHostStatus(selectedHost);

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setSelectedHost(null)}
              className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors"
            >
              <RefreshCw className="w-4 h-4 rotate-180" />
              Back to hosts
            </button>
            <a
              href={`${integration?.url}/zabbix.php?action=host.view&filter_hostids%5B%5D=${selectedHost.hostid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
            >
              View in Zabbix
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl ${getStatusBg(status)} flex items-center justify-center`}>
              {getHostIcon(selectedHost.type)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-stone-900">{selectedHost.name}</h2>
                <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(status)}`} />
              </div>
              <p className="text-sm text-stone-500">{selectedHost.host}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-stone-400">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {selectedHost.location || 'Unknown location'}
                </span>
                <span>{selectedHost.ip}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metrics */}
          {selectedHost.items && selectedHost.items.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Latest Data
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {selectedHost.items.slice(0, 6).map((item) => (
                  <div
                    key={item.itemid}
                    className="p-3 rounded-lg bg-stone-50 border border-stone-200"
                  >
                    <p className="text-xs text-stone-500 mb-1">{item.name}</p>
                    <p className="text-lg font-semibold text-stone-900">
                      {item.lastvalue} {item.units}
                    </p>
                    <p className="text-[10px] text-stone-400">
                      {new Date(parseInt(item.lastclock) * 1000).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Triggers */}
          {selectedHost.triggers && selectedHost.triggers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Active Triggers
              </h3>
              <div className="space-y-2">
                {selectedHost.triggers
                  .filter((t) => t.value === '1')
                  .map((trigger) => (
                    <div
                      key={trigger.triggerid}
                      className={`p-3 rounded-lg border ${
                        trigger.priority === '5'
                          ? 'bg-red-50 border-red-200'
                          : trigger.priority === '4'
                          ? 'bg-orange-50 border-orange-200'
                          : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <p className="text-sm font-medium text-stone-900">{trigger.description}</p>
                      <p className="text-xs text-stone-500 mt-1">
                        Since {new Date(parseInt(trigger.lastchange) * 1000).toLocaleString()}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // No Integration View
  if (!integration?.enabled) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b border-stone-100">
          <h2 className="text-lg font-semibold text-stone-900">Infrastructure</h2>
          <p className="text-sm text-stone-500">Monitor your network and devices</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mb-4">
            <Server className="w-8 h-8 text-stone-400" />
          </div>
          <h3 className="text-lg font-semibold text-stone-900 mb-2">No Zabbix Integration</h3>
          <p className="text-sm text-stone-500 max-w-sm mb-6">
            Connect your Zabbix monitoring system to view real-time infrastructure status,
            alerts, and performance metrics.
          </p>
          <a
            href={`/app/organizations/${org.id}/settings/integrations`}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Configure Integration
          </a>
        </div>
      </div>
    );
  }

  // Hosts List View
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Infrastructure</h2>
            <p className="text-sm text-stone-500">
              {stats.total} hosts • {stats.online} online • {stats.issues} issues • {stats.offline} offline
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync'}
            </button>
            <a
              href={integration.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Zabbix
            </a>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
            <p className="text-xs text-emerald-600 mb-1">Online</p>
            <p className="text-xl font-semibold text-emerald-700">{stats.online}</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
            <p className="text-xs text-amber-600 mb-1">Issues</p>
            <p className="text-xl font-semibold text-amber-700">{stats.issues}</p>
          </div>
          <div className="p-3 rounded-lg bg-red-50 border border-red-100">
            <p className="text-xs text-red-600 mb-1">Offline</p>
            <p className="text-xl font-semibold text-red-700">{stats.offline}</p>
          </div>
          <div className="p-3 rounded-lg bg-stone-50 border border-stone-200">
            <p className="text-xs text-stone-500 mb-1">Total</p>
            <p className="text-xl font-semibold text-stone-700">{stats.total}</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="px-6 py-3 border-b border-stone-100 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search hosts..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all text-sm"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'online', 'issues', 'offline'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === status
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Hosts List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredHosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Server className="w-8 h-8 text-stone-300 mb-2" />
            <p className="text-sm text-stone-500">No hosts found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredHosts.map((host) => {
              const status = getHostStatus(host);
              return (
                <motion.button
                  key={host.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedHost(host)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all hover:shadow-sm ${getStatusBg(
                    status
                  )}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-white/50 flex items-center justify-center">
                    {getHostIcon(host.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-stone-900 truncate">{host.name}</p>
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
                    </div>
                    <p className="text-xs text-stone-500">{host.host}</p>
                    {host.ip && <p className="text-[10px] text-stone-400">{host.ip}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-stone-500">{host.group}</p>
                    {host.triggers?.some((t) => t.value === '1') && (
                      <p className="text-[10px] text-red-600">
                        {host.triggers.filter((t) => t.value === '1').length} alerts
                      </p>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
