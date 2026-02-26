'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Server,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Wifi,
  Router,
  Video,
  Shield,
  ChevronRight,
} from 'lucide-react';
import { useCustomerPortal } from '@/components/customer/CustomerPortalContext';

interface AssetAlertsWidgetProps {
  subdomain: string;
  org: any;
}

interface Asset {
  id: string;
  name: string;
  type: string;
  status: 'healthy' | 'warning' | 'critical';
  lastSeen: string;
  alerts: number;
}

export function AssetAlertsWidget({ subdomain, org }: AssetAlertsWidgetProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const { openSlideOver } = useCustomerPortal();

  const features = org.features || {};
  const hasAssets = features.assets !== false;

  useEffect(() => {
    if (hasAssets) {
      fetchAssets();
      const interval = setInterval(fetchAssets, 60000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [org.id, hasAssets]);

  const fetchAssets = async () => {
    try {
      const res = await fetch(`/api/assets/org/${org.id}?limit=5`);
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
    switch (type.toUpperCase()) {
      case 'AP':
        return <Wifi className="w-4 h-4" />;
      case 'SWITCH':
      case 'ROUTER':
        return <Router className="w-4 h-4" />;
      case 'CAMERA':
      case 'NVR':
        return <Video className="w-4 h-4" />;
      case 'FIREWALL':
        return <Shield className="w-4 h-4" />;
      default:
        return <Server className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (status: Asset['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: Asset['status']) => {
    switch (status) {
      case 'healthy':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'critical':
        return 'bg-red-50 text-red-700 border-red-200';
    }
  };

  const criticalCount = assets.filter((a) => a.status === 'critical').length;
  const warningCount = assets.filter((a) => a.status === 'warning').length;

  if (!hasAssets) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100">
          <Server className="w-4 h-4 text-stone-400" />
          <h3 className="font-semibold text-stone-900">Assets</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <Server className="w-10 h-10 text-stone-300 mb-2" />
          <p className="text-xs text-stone-500">Asset monitoring not enabled</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-indigo-500" />
          <h3 className="font-semibold text-stone-900">Assets</h3>
        </div>
        {(criticalCount > 0 || warningCount > 0) && (
          <div className="flex items-center gap-1">
            {criticalCount > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                {criticalCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                {warningCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Server className="w-8 h-8 text-stone-300 mb-2" />
            <p className="text-xs text-stone-500">No assets configured</p>
          </div>
        ) : (
          <div className="space-y-2">
            {assets.map((asset, index) => (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center gap-3 p-2.5 rounded-lg border ${getStatusColor(
                  asset.status
                )}`}
              >
                <div className="w-8 h-8 rounded-lg bg-white/50 flex items-center justify-center">
                  {getAssetIcon(asset.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{asset.name}</p>
                  <p className="text-[10px] opacity-70">
                    {asset.type} • {asset.alerts > 0 ? `${asset.alerts} alerts` : 'No alerts'}
                  </p>
                </div>
                {getStatusIcon(asset.status)}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {assets.length > 0 && (
        <div className="px-4 py-2 border-t border-stone-100">
          <button className="w-full flex items-center justify-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
            View all assets
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
