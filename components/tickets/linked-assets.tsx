'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Area, Asset, Site } from '@/db/schema';
import { 
  linkAssetToTicketAction, 
  unlinkAssetFromTicketAction,
  linkAssetToTicketBySerialAction,
  linkAssetToTicketByHostnameAction,
} from '@/app/app/actions/ticket-assets';
import { linkCustomerAssetToTicketAction, unlinkCustomerAssetFromTicketAction } from '@/app/s/[subdomain]/actions/ticket-assets';
import { useRouter } from 'next/navigation';
import { Server, Unlink, Link2, Hash, Globe } from 'lucide-react';

interface LinkedAsset {
  asset: Asset & {
    site?: Site | null;
    area?: Area | null;
  };
}

interface LinkedAssetsProps {
  ticketId: string;
  linkedAssets: LinkedAsset[];
  availableAssets: (Asset & { site?: Site | null; area?: Area | null })[];
  canEdit: boolean;
  scope: 'internal' | 'customer';
}

export function LinkedAssets({
  ticketId,
  linkedAssets,
  availableAssets,
  canEdit,
  scope,
}: LinkedAssetsProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [unlinkingAssetId, setUnlinkingAssetId] = useState<string | null>(null);
  
  // Serial/Hostname lookup states
  const [serialNumber, setSerialNumber] = useState('');
  const [hostname, setHostname] = useState('');
  const [linkMode, setLinkMode] = useState<'browse' | 'serial' | 'hostname'>('browse');

  const linkedIds = useMemo(
    () => new Set(linkedAssets.map((link) => link.asset.id)),
    [linkedAssets]
  );

  const filteredAssets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return availableAssets.filter((asset) => {
      if (linkedIds.has(asset.id)) return false;
      if (!term) return true;
      return (
        asset.name.toLowerCase().includes(term) ||
        asset.type.toLowerCase().includes(term) ||
        (asset.hostname || '').toLowerCase().includes(term) ||
        (asset.serialNumber || '').toLowerCase().includes(term)
      );
    });
  }, [availableAssets, linkedIds, search]);

  const handleLink = async () => {
    if (!selectedAssetId) return;
    setIsLinking(true);
    try {
      if (scope === 'internal') {
        await linkAssetToTicketAction(ticketId, selectedAssetId);
      } else {
        await linkCustomerAssetToTicketAction(ticketId, selectedAssetId);
      }
      setSelectedAssetId('');
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to link asset');
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (assetId: string) => {
    setUnlinkingAssetId(assetId);
    try {
      if (scope === 'internal') {
        await unlinkAssetFromTicketAction(ticketId, assetId);
      } else {
        await unlinkCustomerAssetFromTicketAction(ticketId, assetId);
      }
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to unlink asset');
    } finally {
      setUnlinkingAssetId(null);
    }
  };

  const handleLinkBySerial = async () => {
    if (!serialNumber.trim()) return;
    setIsLinking(true);
    try {
      await linkAssetToTicketBySerialAction(ticketId, serialNumber);
      setSerialNumber('');
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to link asset');
    } finally {
      setIsLinking(false);
    }
  };

  const handleLinkByHostname = async () => {
    if (!hostname.trim()) return;
    setIsLinking(true);
    try {
      await linkAssetToTicketByHostnameAction(ticketId, hostname);
      setHostname('');
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to link asset');
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="w-5 h-5" />
          Linked Assets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {linkedAssets.length === 0 ? (
          <p className="text-sm text-gray-500">No assets linked yet.</p>
        ) : (
          <div className="space-y-2">
            {linkedAssets.map((link) => (
              <div key={link.asset.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{link.asset.name}</p>
                  <div className="flex flex-wrap gap-1 text-xs text-gray-500 mt-1">
                    <Badge variant="outline">{link.asset.type}</Badge>
                    <Badge variant={link.asset.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {link.asset.status}
                    </Badge>
                    {link.asset.site && <Badge variant="outline">{link.asset.site.name}</Badge>}
                    {link.asset.area && <Badge variant="outline">{link.asset.area.name}</Badge>}
                  </div>
                  {(link.asset.serialNumber || link.asset.hostname) && (
                    <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                      {link.asset.serialNumber && (
                        <div className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          S/N: {link.asset.serialNumber}
                        </div>
                      )}
                      {link.asset.hostname && (
                        <div className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          Host: {link.asset.hostname}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnlink(link.asset.id)}
                    disabled={unlinkingAssetId === link.asset.id}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Unlink className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {canEdit && scope === 'internal' && (
          <div className="border-t pt-4">
            <Label className="text-sm font-medium mb-2 block">Link Asset</Label>
            
            {/* Mode selector buttons */}
            <div className="flex gap-2 mb-3">
              <Button
                type="button"
                variant={linkMode === 'browse' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLinkMode('browse')}
              >
                Browse
              </Button>
              <Button
                type="button"
                variant={linkMode === 'serial' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLinkMode('serial')}
              >
                <Hash className="w-3 h-3 mr-1" />
                Serial #
              </Button>
              <Button
                type="button"
                variant={linkMode === 'hostname' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLinkMode('hostname')}
              >
                <Globe className="w-3 h-3 mr-1" />
                Hostname
              </Button>
            </div>
            
            {/* Browse mode */}
            {linkMode === 'browse' && (
              <div className="space-y-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, type, serial or hostname..."
                />
                <div className="flex gap-2">
                  <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select an asset" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredAssets.length === 0 && (
                        <SelectItem value="none" disabled>
                          No matching assets
                        </SelectItem>
                      )}
                      {filteredAssets.map((asset) => (
                        <SelectItem key={asset.id} value={asset.id}>
                          {asset.name} ({asset.type})
                          {asset.serialNumber && ` • S/N: ${asset.serialNumber}`}
                          {asset.hostname && ` • ${asset.hostname}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleLink} 
                    disabled={!selectedAssetId || isLinking}
                    size="sm"
                  >
                    <Link2 className="w-4 h-4 mr-1" />
                    Link
                  </Button>
                </div>
              </div>
            )}

            {/* Serial mode */}
            {linkMode === 'serial' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="Enter serial number..."
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleLinkBySerial} 
                    disabled={!serialNumber.trim() || isLinking}
                    size="sm"
                  >
                    <Link2 className="w-4 h-4 mr-1" />
                    Link
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Enter the exact serial number to find and link the asset
                </p>
              </div>
            )}

            {/* Hostname mode */}
            {linkMode === 'hostname' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={hostname}
                    onChange={(e) => setHostname(e.target.value)}
                    placeholder="Enter hostname..."
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleLinkByHostname} 
                    disabled={!hostname.trim() || isLinking}
                    size="sm"
                  >
                    <Link2 className="w-4 h-4 mr-1" />
                    Link
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Enter the exact hostname to find and link the asset
                </p>
              </div>
            )}
          </div>
        )}

        {canEdit && scope === 'customer' && (
          <div className="border-t pt-4 space-y-2">
            <Label htmlFor="asset-search">Link an asset</Label>
            <Input
              id="asset-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search assets..."
            />
            <div className="flex gap-2">
              <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select an asset" />
                </SelectTrigger>
                <SelectContent>
                  {filteredAssets.length === 0 && (
                    <SelectItem value="none" disabled>
                      No matching assets
                    </SelectItem>
                  )}
                  {filteredAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name} ({asset.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleLink} disabled={!selectedAssetId || isLinking}>
                {isLinking ? 'Linking...' : 'Link'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
