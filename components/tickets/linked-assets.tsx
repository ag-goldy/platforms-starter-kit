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
import { linkAssetToTicketAction, unlinkAssetFromTicketAction } from '@/app/app/actions/ticket-assets';
import { linkCustomerAssetToTicketAction, unlinkCustomerAssetFromTicketAction } from '@/app/s/[subdomain]/actions/ticket-assets';
import { useRouter } from 'next/navigation';

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linked Assets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {linkedAssets.length === 0 ? (
          <p className="text-sm text-gray-500">No assets linked yet.</p>
        ) : (
          <div className="space-y-2">
            {linkedAssets.map((link) => (
              <div key={link.asset.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{link.asset.name}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <Badge variant="outline">{link.asset.type}</Badge>
                    <Badge variant="outline">{link.asset.status}</Badge>
                    {link.asset.site && <Badge variant="secondary">{link.asset.site.name}</Badge>}
                    {link.asset.area && <Badge variant="secondary">{link.asset.area.name}</Badge>}
                  </div>
                </div>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnlink(link.asset.id)}
                    disabled={unlinkingAssetId === link.asset.id}
                  >
                    {unlinkingAssetId === link.asset.id ? 'Unlinking...' : 'Unlink'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="space-y-2 border-t pt-4">
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
