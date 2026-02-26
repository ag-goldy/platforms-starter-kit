'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Area, Asset, Site } from '@/db/schema';
import { AssetDialog } from '@/components/assets/asset-dialog';
import { formatDateTime } from '@/lib/utils/date';
import { useToast } from '@/components/ui/toast';
import { Archive, ArchiveRestore, Trash2, Loader2, Upload } from 'lucide-react';
import { AssetBatchImport } from '@/components/assets/asset-batch-import';

interface AssetWithRelations extends Asset {
  site?: Site | null;
  area?: Area | null;
  archivedByUser?: { id: string; name: string | null; email: string } | null;
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
  const router = useRouter();
  const { success, error } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Asset['status']>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | Asset['type']>('all');
  const [siteFilter, setSiteFilter] = useState<'all' | string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'recent' | 'tickets'>('name');
  
  // Archive/Delete dialog state
  const [assetToDelete, setAssetToDelete] = useState<AssetWithRelations | null>(null);
  const [assetToArchive, setAssetToArchive] = useState<AssetWithRelations | null>(null);
  const [assetToUnarchive, setAssetToUnarchive] = useState<AssetWithRelations | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

  // Archive handler
  const handleArchive = async (asset: AssetWithRelations) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to archive asset');
      }

      success('Asset archived successfully');
      router.refresh();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to archive asset');
    } finally {
      setIsProcessing(false);
      setAssetToArchive(null);
    }
  };

  // Unarchive handler
  const handleUnarchive = async (asset: AssetWithRelations) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unarchive' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to unarchive asset');
      }

      success('Asset unarchived successfully');
      router.refresh();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to unarchive asset');
    } finally {
      setIsProcessing(false);
      setAssetToUnarchive(null);
    }
  };

  // Delete handler
  const handleDelete = async (asset: AssetWithRelations) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.linkedTicketCount) {
          throw new Error(`Cannot delete: Asset has ${data.linkedTicketCount} linked ticket(s). Please unlink tickets first.`);
        }
        throw new Error(data.error || 'Failed to delete asset');
      }

      success('Asset deleted successfully');
      router.refresh();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to delete asset');
    } finally {
      setIsProcessing(false);
      setAssetToDelete(null);
    }
  };

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
      // Archive filter
      if (!showArchived && asset.archived) {
        return false;
      }
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
  }, [assets, assetStats, search, siteFilter, statusFilter, typeFilter, sortBy, showArchived]);

  const hasFilters =
    search.trim().length > 0 ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    siteFilter !== 'all' ||
    showArchived;

  return (
    <div className="space-y-4">
      {moduleCards}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Assets</h2>
          <p className="text-sm text-gray-600">Track infrastructure and linked tickets.</p>
        </div>
        <div className="flex gap-2">
          <AssetBatchImport orgId={orgId} subdomain={basePath.split('/')[2]} />
          <Button onClick={() => setIsCreating(true)}>Create Asset</Button>
        </div>
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
                <div className="flex items-center gap-4">
                  <span>
                    Showing {filteredAssets.length} of {assets.length}
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={showArchived}
                      onCheckedChange={(checked) => setShowArchived(checked as boolean)}
                    />
                    <span>Show archived</span>
                  </label>
                </div>
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
                        setShowArchived(false);
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
                <Card key={asset.id} className={asset.archived ? 'opacity-75' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">
                          <Link href={`${basePath}/${asset.id}`} className="hover:underline">
                            {asset.name}
                          </Link>
                        </CardTitle>
                        <p className="text-xs text-gray-500">{asset.type}</p>
                      </div>
                      {asset.archived && (
                        <Badge variant="secondary" className="shrink-0">Archived</Badge>
                      )}
                    </div>
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
                    {asset.archived && asset.archivedAt && (
                      <p className="text-xs text-orange-600">
                        Archived {formatDateTime(asset.archivedAt)}
                        {asset.archivedByUser && ` by ${asset.archivedByUser.name || asset.archivedByUser.email}`}
                      </p>
                    )}
                    <div className="text-xs text-gray-500">
                      Linked tickets: {ticketCount}
                      {lastLinkedAt && (
                        <span> · Last linked {formatDateTime(lastLinkedAt)}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!asset.archived ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setEditingAssetId(asset.id)}>
                            Edit
                          </Button>
                          <Link href={`${basePath}/${asset.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full">
                              View
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-500 hover:text-orange-600"
                            onClick={() => setAssetToArchive(asset)}
                            title="Archive"
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-500 hover:text-red-600"
                            onClick={() => setAssetToDelete(asset)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Link href={`${basePath}/${asset.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full">
                              View
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-orange-600 hover:text-orange-700"
                            onClick={() => setAssetToUnarchive(asset)}
                          >
                            <ArchiveRestore className="h-4 w-4 mr-2" />
                            Unarchive
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-500 hover:text-red-600"
                            onClick={() => setAssetToDelete(asset)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
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

      {/* Archive Confirmation Dialog */}
      <Dialog open={!!assetToArchive} onOpenChange={() => setAssetToArchive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Asset</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive &quot;{assetToArchive?.name}&quot;? 
              Archived assets will be hidden from the default view but can be restored later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetToArchive(null)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              variant="default" 
              onClick={() => assetToArchive && handleArchive(assetToArchive)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Archiving...
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unarchive Confirmation Dialog */}
      <Dialog open={!!assetToUnarchive} onOpenChange={() => setAssetToUnarchive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unarchive Asset</DialogTitle>
            <DialogDescription>
              Restore &quot;{assetToUnarchive?.name}&quot; to the active assets list?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetToUnarchive(null)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              variant="default" 
              onClick={() => assetToUnarchive && handleUnarchive(assetToUnarchive)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <ArchiveRestore className="h-4 w-4 mr-2" />
                  Unarchive
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!assetToDelete} onOpenChange={() => setAssetToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete &quot;{assetToDelete?.name}&quot;?
              <br /><br />
              <span className="text-red-600 font-medium">This action cannot be undone.</span>
              <br /><br />
              Note: Assets with linked tickets cannot be deleted. You must unlink all tickets first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetToDelete(null)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => assetToDelete && handleDelete(assetToDelete)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Permanently
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
