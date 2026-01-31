'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { createSiteAction, updateSiteAction } from '@/app/app/actions/sites';
import { useRouter } from 'next/navigation';
import type { Site } from '@/db/schema';
import { slugify } from '@/lib/utils/slug';

interface SiteDialogProps {
  orgId: string;
  onClose: () => void;
  initialData?: Site | null;
}

export function SiteDialog({ orgId, onClose, initialData }: SiteDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    address: initialData?.address || '',
    timezone: initialData?.timezone || '',
    notes: initialData?.notes || '',
    isActive: initialData?.isActive ?? true,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (initialData?.id) {
        await updateSiteAction(orgId, initialData.id, formState);
      } else {
        await createSiteAction(orgId, formState);
      }
      router.refresh();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save site');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Site' : 'Create Site'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="site-name">Name</Label>
              <Input
                id="site-name"
                value={formState.name}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setFormState((prev) => ({
                    ...prev,
                    name: nextName,
                    slug: prev.slug ? prev.slug : slugify(nextName),
                  }));
                }}
                placeholder="e.g., HQ - Downtown"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="site-slug">Slug</Label>
              <Input
                id="site-slug"
                value={formState.slug}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, slug: slugify(event.target.value) }))
                }
                placeholder="hq-downtown"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="site-address">Address</Label>
            <Input
              id="site-address"
              value={formState.address}
              onChange={(event) => setFormState((prev) => ({ ...prev, address: event.target.value }))}
              placeholder="Street, City, State"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="site-timezone">Timezone</Label>
            <Input
              id="site-timezone"
              value={formState.timezone}
              onChange={(event) => setFormState((prev) => ({ ...prev, timezone: event.target.value }))}
              placeholder="America/New_York"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="site-notes">Notes</Label>
            <Textarea
              id="site-notes"
              value={formState.notes}
              onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
              rows={3}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={formState.isActive}
              onCheckedChange={(checked) =>
                setFormState((prev) => ({ ...prev, isActive: checked === true }))
              }
            />
            Active
          </label>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Site'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
