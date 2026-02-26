'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  HardDrive,
  Server,
  Wifi,
  WifiOff,
  AlertTriangle,
  Search,
  Plus,
  MoreHorizontal,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import type { Asset, ZabbixHost } from '@/db/schema';

interface AssetsSlideOverProps {
  subdomain: string;
  org: { id: string; name: string } | null;
  onClose: () => void;
}

export function AssetsSlideOver({ subdomain, org, onClose }: AssetsSlideOverProps) {
  const [assets, setAssets] = useState<(Asset & { zabbixHost?: ZabbixHost })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { showToast } = useToast();

  const fetchAssets = async () => {
    if (!org?.id) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/assets/org/${org.id}`);
      if (!response.ok) throw new Error('Failed to fetch assets');
      const data = await response.json();
      setAssets(data.assets || []);
    } catch (error) {
      console.error('Error fetching assets:', error);
      showToast('Failed to load assets. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [org?.id]);

  const handleSyncWithZabbix = async () => {
    try {
      const response = await fetch(`/api/zabbix/sync?orgId=${org?.id}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Sync failed');
      
      showToast('Zabbix synchronization has been initiated.', 'info');
      
      // Refresh after a delay
      setTimeout(fetchAssets, 3000);
    } catch (error) {
      showToast('Could not sync with Zabbix. Please check your configuration.', 'error');
    }
  };

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      searchQuery === '' ||
      asset.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.hostname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.ipAddress?.includes(searchQuery);

    const matchesStatus =
      statusFilter === 'all' || asset.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const getAssetHealth = (asset: Asset & { zabbixHost?: ZabbixHost }) => {
    if (!asset.zabbixHostId) return 'unmonitored';
    if (asset.zabbixHost?.available === '1') return 'online';
    if (asset.zabbixHost?.available === '2') return 'offline';
    return 'issues';
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'online':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'offline':
        return <WifiOff className="w-4 h-4 text-red-500" />;
      case 'issues':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default:
        return <HardDrive className="w-4 h-4 text-stone-400" />;
    }
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'online':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Online</Badge>;
      case 'offline':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Offline</Badge>;
      case 'issues':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Issues</Badge>;
      default:
        return <Badge variant="outline">Unmonitored</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700">Active</Badge>;
      case 'maintenance':
        return <Badge className="bg-amber-100 text-amber-700">Maintenance</Badge>;
      case 'retired':
        return <Badge className="bg-stone-100 text-stone-700">Retired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="h-full flex flex-col bg-stone-50">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-stone-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Assets</h2>
            <p className="text-sm text-stone-500">Manage your infrastructure assets</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncWithZabbix}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Sync with Zabbix
            </Button>
            <Button size="sm" className="gap-2 bg-brand-600 hover:bg-brand-700">
              <Plus className="w-4 h-4" />
              Add Asset
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 bg-white border-b border-stone-200">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="retired">Retired</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full"
            />
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-12">
            <Server className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-stone-900 mb-2">No assets found</h3>
            <p className="text-stone-500 mb-6">
              {assets.length === 0
                ? "You haven't added any assets yet."
                : "No assets match your search criteria."}
            </p>
            {assets.length === 0 && (
              <Button onClick={handleSyncWithZabbix} variant="outline" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Sync with Zabbix
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAssets.map((asset) => {
              const health = getAssetHealth(asset);
              return (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-lg border border-stone-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-stone-100">
                        {getHealthIcon(health)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-stone-900">{asset.name}</h3>
                          {getHealthBadge(health)}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-stone-500">
                          {asset.hostname && (
                            <span className="font-mono">{asset.hostname}</span>
                          )}
                          {asset.ipAddress && (
                            <span className="font-mono text-stone-400">{asset.ipAddress}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {getStatusBadge(asset.status)}
                          {asset.type && (
                            <Badge variant="outline">{asset.type}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="gap-2">
                          <ExternalLink className="w-4 h-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>Edit Asset</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          Delete Asset
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="px-6 py-3 bg-white border-t border-stone-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-stone-500">
            {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-4 text-stone-500">
            <span className="flex items-center gap-1">
              <Wifi className="w-3 h-3 text-green-500" />
              {assets.filter((a) => getAssetHealth(a) === 'online').length} online
            </span>
            <span className="flex items-center gap-1">
              <WifiOff className="w-3 h-3 text-red-500" />
              {assets.filter((a) => getAssetHealth(a) === 'offline').length} offline
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              {assets.filter((a) => getAssetHealth(a) === 'issues').length} issues
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
