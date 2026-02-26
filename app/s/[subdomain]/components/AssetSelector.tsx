'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server,
  Wifi,
  Router,
  Video,
  Shield,
  Search,
  X,
  Link,
  Check,
  AlertCircle,
  Database,
  Cloud,
} from 'lucide-react';

interface Asset {
  id: string;
  name: string;
  type: string;
  hostname?: string;
  ipAddress?: string;
  status: string;
  zabbixHostId?: string;
  isZabbixSynced: boolean;
}

interface AssetSelectorProps {
  orgId: string;
  subdomain: string;
  linkedAssets: Asset[];
  onLink: (asset: Asset) => void;
  onUnlink: (assetId: string) => void;
  onClose: () => void;
}

export function AssetSelector({ orgId, subdomain, linkedAssets, onLink, onUnlink, onClose }: AssetSelectorProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'zabbix' | 'manual'>('all');

  useEffect(() => {
    fetchAssets();
  }, [orgId]);

  const fetchAssets = async () => {
    try {
      const res = await fetch(`/api/assets/org/${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
      }
    } catch (error) {
      console.error('Failed to fetch assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAssetIcon = (type: string) => {
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
      case 'DATABASE':
        return <Database className="w-5 h-5" />;
      case 'CLOUD':
        return <Cloud className="w-5 h-5" />;
      default:
        return <Server className="w-5 h-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500';
      case 'MAINTENANCE':
        return 'bg-amber-500';
      case 'RETIRED':
        return 'bg-stone-400';
      default:
        return 'bg-stone-400';
    }
  };

  const isLinked = (assetId: string) => {
    return linkedAssets.some((a) => a.id === assetId);
  };

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.hostname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.ipAddress?.includes(searchQuery);

    const matchesTab =
      activeTab === 'all'
        ? true
        : activeTab === 'zabbix'
        ? asset.isZabbixSynced
        : !asset.isZabbixSynced;

    return matchesSearch && matchesTab;
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Link Assets</h2>
            <p className="text-sm text-stone-500">
              {linkedAssets.length} linked • {assets.length} available
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-3 border-b border-stone-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all text-sm"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-2 border-b border-stone-100">
        <div className="flex gap-2">
          {[
            { id: 'all', label: 'All Assets' },
            { id: 'zabbix', label: 'Zabbix Synced' },
            { id: 'manual', label: 'Manual' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Asset List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Server className="w-8 h-8 text-stone-300 mb-2" />
            <p className="text-sm text-stone-500">No assets found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAssets.map((asset) => {
              const linked = isLinked(asset.id);
              return (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    linked
                      ? 'bg-brand-50 border-brand-200'
                      : 'bg-white border-stone-200 hover:border-brand-300'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600">
                    {getAssetIcon(asset.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-stone-900 truncate">
                        {asset.name}
                      </p>
                      {asset.isZabbixSynced && (
                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium rounded">
                          Zabbix
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-stone-500">
                      <span className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(asset.status)}`} />
                        {asset.status}
                      </span>
                      {asset.hostname && <span>{asset.hostname}</span>}
                      {asset.ipAddress && <span>{asset.ipAddress}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => (linked ? onUnlink(asset.id) : onLink(asset))}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      linked
                        ? 'bg-stone-200 text-stone-700 hover:bg-red-100 hover:text-red-700'
                        : 'bg-brand-500 text-white hover:bg-brand-600'
                    }`}
                  >
                    {linked ? (
                      <>
                        <Check className="w-3 h-3" />
                        Linked
                      </>
                    ) : (
                      <>
                        <Link className="w-3 h-3" />
                        Link
                      </>
                    )}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Linked Assets Summary */}
      {linkedAssets.length > 0 && (
        <div className="px-6 py-4 border-t border-stone-100 bg-stone-50">
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
            Currently Linked
          </h4>
          <div className="flex flex-wrap gap-2">
            {linkedAssets.map((asset) => (
              <div
                key={asset.id}
                className="flex items-center gap-1.5 px-2 py-1 bg-white border border-stone-200 rounded-lg text-xs"
              >
                {getAssetIcon(asset.type)}
                <span className="truncate max-w-[100px]">{asset.name}</span>
                <button
                  onClick={() => onUnlink(asset.id)}
                  className="ml-1 text-stone-400 hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
