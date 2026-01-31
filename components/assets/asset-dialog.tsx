'use client';

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Area, Asset, Site } from '@/db/schema';
import { createAssetAction, updateAssetAction } from '@/app/app/actions/assets';
import { createCustomerAssetAction, updateCustomerAssetAction } from '@/app/s/[subdomain]/actions/assets';
import { useRouter } from 'next/navigation';

interface AssetDialogProps {
  orgId: string;
  sites: Site[];
  areas: Area[];
  onClose: () => void;
  initialData?: Asset | null;
  scope: 'internal' | 'customer';
}

export function AssetDialog({ orgId, sites, areas, onClose, initialData, scope }: AssetDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    name: initialData?.name || '',
    type: initialData?.type || 'OTHER',
    status: initialData?.status || 'ACTIVE',
    siteId: initialData?.siteId || '',
    areaId: initialData?.areaId || '',
    hostname: initialData?.hostname || '',
    serialNumber: initialData?.serialNumber || '',
    model: initialData?.model || '',
    vendor: initialData?.vendor || '',
    ipAddress: initialData?.ipAddress || '',
    macAddress: initialData?.macAddress || '',
    tags: initialData?.tags?.join(', ') || '',
    notes: initialData?.notes || '',
  });

  const availableAreas = useMemo(() => {
    if (!formState.siteId) {
      return areas;
    }
    return areas.filter((area) => area.siteId === formState.siteId);
  }, [areas, formState.siteId]);

  const saveAsset = scope === 'internal' ? createAssetAction : createCustomerAssetAction;
  const updateAsset = scope === 'internal' ? updateAssetAction : updateCustomerAssetAction;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        ...formState,
        siteId: formState.siteId || null,
        areaId: formState.areaId || null,
      };

      if (initialData?.id) {
        await updateAsset(orgId, initialData.id, payload);
      } else {
        await saveAsset(orgId, payload);
      }

      router.refresh();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Asset' : 'Create Asset'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asset-name">Name</Label>
              <Input
                id="asset-name"
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g., Core Switch"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="asset-type">Type</Label>
              <Select
                value={formState.type}
                onValueChange={(value) =>
                  setFormState((prev) => ({ ...prev, type: value as Asset['type'] }))
                }
              >
                <SelectTrigger id="asset-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AP">AP</SelectItem>
                  <SelectItem value="SWITCH">Switch</SelectItem>
                  <SelectItem value="FIREWALL">Firewall</SelectItem>
                  <SelectItem value="CAMERA">Camera</SelectItem>
                  <SelectItem value="NVR">NVR</SelectItem>
                  <SelectItem value="SERVER">Server</SelectItem>
                  <SelectItem value="ISP_CIRCUIT">ISP Circuit</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asset-status">Status</Label>
              <Select
                value={formState.status}
                onValueChange={(value) =>
                  setFormState((prev) => ({ ...prev, status: value as Asset['status'] }))
                }
              >
                <SelectTrigger id="asset-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  <SelectItem value="RETIRED">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="asset-site">Site</Label>
              <Select
                value={formState.siteId || 'none'}
                onValueChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    siteId: value === 'none' ? '' : value,
                    areaId: '',
                  }))
                }
              >
                <SelectTrigger id="asset-site">
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No site</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asset-area">Area</Label>
              <Select
                value={formState.areaId || 'none'}
                onValueChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    areaId: value === 'none' ? '' : value,
                  }))
                }
              >
                <SelectTrigger id="asset-area">
                  <SelectValue placeholder="Select an area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No area</SelectItem>
                  {availableAreas.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="asset-hostname">Hostname</Label>
              <Input
                id="asset-hostname"
                value={formState.hostname}
                onChange={(event) => setFormState((prev) => ({ ...prev, hostname: event.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asset-serial">Serial Number</Label>
              <Input
                id="asset-serial"
                value={formState.serialNumber}
                onChange={(event) => setFormState((prev) => ({ ...prev, serialNumber: event.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-model">Model</Label>
              <Input
                id="asset-model"
                value={formState.model}
                onChange={(event) => setFormState((prev) => ({ ...prev, model: event.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asset-vendor">Vendor</Label>
              <Input
                id="asset-vendor"
                value={formState.vendor}
                onChange={(event) => setFormState((prev) => ({ ...prev, vendor: event.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-ip">IP Address</Label>
              <Input
                id="asset-ip"
                value={formState.ipAddress}
                onChange={(event) => setFormState((prev) => ({ ...prev, ipAddress: event.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asset-mac">MAC Address</Label>
              <Input
                id="asset-mac"
                value={formState.macAddress}
                onChange={(event) => setFormState((prev) => ({ ...prev, macAddress: event.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-tags">Tags</Label>
              <Input
                id="asset-tags"
                value={formState.tags}
                onChange={(event) => setFormState((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="comma, separated, tags"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="asset-notes">Notes</Label>
            <Textarea
              id="asset-notes"
              value={formState.notes}
              onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Asset'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
