'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Area, Asset, Site } from '@/db/schema';
import { AssetDialog } from '@/components/assets/asset-dialog';
import { formatDateTime } from '@/lib/utils/date';

interface AssetWithRelations extends Asset {
  site?: Site | null;
  area?: Area | null;
}

interface AssetStats {
  ticketCount: number;
  lastLinkedAt?: Date | string | null;
}

interface ModuleShortcut {
  title: string;
  description: string;
  href?: string;
  badge?: string;
  count?: number;
  footer?: string;
}

interface AssetsManagerProps {
  orgId: string;
  assets: AssetWithRelations[];
  sites: Site[];
  areas: Area[];
  scope: 'internal' | 'customer';
  basePath: string;
  assetStats?: Record<string, AssetStats>;
  modules?: ModuleShortcut[];
}

export function AssetsManager({
  orgId,
  assets,
  sites,
  areas,
  scope,
  basePath,
  assetStats,
  modules,
}: AssetsManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Asset['status']>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | Asset['type']>('all');
  const [siteFilter, setSiteFilter] = useState<'all' | string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'recent' | 'tickets'>('name');

  const moduleCards = modules && modules.length > 0 && (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Modules</h2>
        <p className="text-sm text-gray-600">Latest portal modules for this organization.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {modules.map((module) => {
          const content = (
            <div className="flex h-full flex-col justify-between space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{module.title}</h3>
                  {module.badge && <Badge variant="secondary">{module.badge}</Badge>}
                </div>
                <p className="text-xs text-gray-600">{module.description}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{typeof module.count === 'number' ? `${module.count} items` : ''}</span>
                <span className="text-gray-400">
                  {module.footer || (module.href ? 'Open →' : '')}
                </span>
              </div>
            </div>
          );

          return module.href ? (
            <Link
              key={module.title}
              href={module.href}
              className="block h-full rounded-lg border bg-white p-4 transition-colors hover:bg-gray-50"
            >
              {content}
            </Link>
          ) : (
            <div key={module.title} className="rounded-lg border bg-white p-4">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );

  const assetTypes = useMemo(() => {
    const types = new Set<Asset['type']>();
    assets.forEach((asset) => types.add(asset.type));
    return Array.from(types).sort();
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const term = search.trim().toLowerCase();
    const withStats = assets.map((asset) => {
      const stats = assetStats?.[asset.id];
      const lastLinkedAt = stats?.lastLinkedAt
        ? new Date(stats.lastLinkedAt)
        : null;
      return {
        asset,
        ticketCount: stats?.ticketCount ?? 0,
        lastLinkedAt,
      };
    });

    const results = withStats.filter(({ asset }) => {
      if (statusFilter !== 'all' && asset.status !== statusFilter) {
        return false;
      }
      if (typeFilter !== 'all' && asset.type !== typeFilter) {
        return false;
      }
      if (siteFilter !== 'all' && asset.siteId !== siteFilter) {
        return false;
      }
      if (!term) return true;

      const haystack = [
        asset.name,
        asset.hostname,
        asset.serialNumber,
        asset.ipAddress,
        asset.model,
        asset.vendor,
        asset.site?.name,
        asset.area?.name,
        asset.tags?.join(', '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });

    results.sort((a, b) => {
      if (sortBy === 'tickets') {
        return b.ticketCount - a.ticketCount;
      }
      if (sortBy === 'recent') {
        const aTime = a.lastLinkedAt ? a.lastLinkedAt.getTime() : 0;
        const bTime = b.lastLinkedAt ? b.lastLinkedAt.getTime() : 0;
        return bTime - aTime;
      }
      return a.asset.name.localeCompare(b.asset.name);
    });

    return results;
  }, [assets, assetStats, search, siteFilter, statusFilter, typeFilter, sortBy]);

  const hasFilters =
    search.trim().length > 0 ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    siteFilter !== 'all';

  return (
    <div className="space-y-4">
      {moduleCards}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Assets</h2>
          <p className="text-sm text-gray-600">Track infrastructure and linked tickets.</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>Create Asset</Button>
      </div>

      {assets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-gray-500">No assets yet. Add your first asset.</p>
            <Button className="mt-4" onClick={() => setIsCreating(true)}>
              Create Asset
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="py-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="xl:col-span-2">
                  <Input
                    placeholder="Search assets by name, IP, site, or tag..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value as typeof statusFilter)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    <SelectItem value="RETIRED">Retired</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={typeFilter}
                  onValueChange={(value) =>
                    setTypeFilter(value as typeof typeFilter)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {assetTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={siteFilter}
                  onValueChange={(value) => setSiteFilter(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sites</SelectItem>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                <span>
                  Showing {filteredAssets.length} of {assets.length}
                </span>
                <div className="flex items-center gap-2">
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                    <SelectTrigger className="h-8 w-[160px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Sort: Name</SelectItem>
                      <SelectItem value="recent">Sort: Recently Linked</SelectItem>
                      <SelectItem value="tickets">Sort: Most Tickets</SelectItem>
                    </SelectContent>
                  </Select>
                  {hasFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearch('');
                        setStatusFilter('all');
                        setTypeFilter('all');
                        setSiteFilter('all');
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {filteredAssets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-gray-500">
                No assets match those filters.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredAssets.map(({ asset, ticketCount, lastLinkedAt }) => (
                <Card key={asset.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      <Link href={`${basePath}/${asset.id}`} className="hover:underline">
                        {asset.name}
                      </Link>
                    </CardTitle>
                    <p className="text-xs text-gray-500">{asset.type}</p>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-gray-600">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{asset.status}</Badge>
                      {asset.site && <Badge variant="secondary">{asset.site.name}</Badge>}
                      {asset.area && <Badge variant="secondary">{asset.area.name}</Badge>}
                    </div>
                    {asset.hostname && <p>Hostname: {asset.hostname}</p>}
                    {asset.ipAddress && <p>IP: {asset.ipAddress}</p>}
                    {asset.serialNumber && <p>Serial: {asset.serialNumber}</p>}
                    <div className="text-xs text-gray-500">
                      Linked tickets: {ticketCount}
                      {lastLinkedAt && (
                        <span> · Last linked {formatDateTime(lastLinkedAt)}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingAssetId(asset.id)}>
                        Edit
                      </Button>
                      <Link href={`${basePath}/${asset.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          View
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {isCreating && (
        <AssetDialog
          orgId={orgId}
          sites={sites}
          areas={areas}
          scope={scope}
          onClose={() => setIsCreating(false)}
        />
      )}
      {editingAssetId && (
        <AssetDialog
          orgId={orgId}
          sites={sites}
          areas={areas}
          scope={scope}
          initialData={assets.find((asset) => asset.id === editingAssetId) || null}
          onClose={() => setEditingAssetId(null)}
        />
      )}
    </div>
  );
}
