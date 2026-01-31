'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import type { Area } from '@/db/schema';
import { createAreaAction, updateAreaAction } from '@/app/app/actions/sites';
import { useRouter } from 'next/navigation';

interface AreaDialogProps {
  orgId: string;
  siteId: string;
  onClose: () => void;
  initialData?: Area | null;
}

export function AreaDialog({ orgId, siteId, onClose, initialData }: AreaDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    name: initialData?.name || '',
    floor: initialData?.floor || '',
    notes: initialData?.notes || '',
    isActive: initialData?.isActive ?? true,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (initialData?.id) {
        await updateAreaAction(orgId, initialData.id, formState);
      } else {
        await createAreaAction(orgId, siteId, formState);
      }
      router.refresh();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save area');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Area' : 'Create Area'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="area-name">Name</Label>
            <Input
              id="area-name"
              value={formState.name}
              onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="e.g., Server Room"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="area-floor">Floor</Label>
            <Input
              id="area-floor"
              value={formState.floor}
              onChange={(event) => setFormState((prev) => ({ ...prev, floor: event.target.value }))}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="area-notes">Notes</Label>
            <Textarea
              id="area-notes"
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
              {isSubmitting ? 'Saving...' : 'Save Area'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
