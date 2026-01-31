'use client';

import { useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import type { Notice, Site } from '@/db/schema';
import { createNoticeAction, updateNoticeAction } from '@/app/app/actions/notices';
import { useRouter } from 'next/navigation';

interface NoticeDialogProps {
  orgId: string;
  sites: Site[];
  onClose: () => void;
  initialData?: Notice | null;
}

export function NoticeDialog({ orgId, sites, onClose, initialData }: NoticeDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    siteId: initialData?.siteId || '',
    type: initialData?.type || 'MAINTENANCE',
    severity: initialData?.severity || 'INFO',
    title: initialData?.title || '',
    body: initialData?.body || '',
    startsAt: initialData?.startsAt ? new Date(initialData.startsAt).toISOString().slice(0, 16) : '',
    endsAt: initialData?.endsAt ? new Date(initialData.endsAt).toISOString().slice(0, 16) : '',
    isActive: initialData?.isActive ?? true,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        ...formState,
        siteId: formState.siteId || null,
      };

      if (initialData?.id) {
        await updateNoticeAction(orgId, initialData.id, payload);
      } else {
        await createNoticeAction(orgId, payload);
      }

      router.refresh();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save notice');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Notice' : 'Create Notice'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="notice-type">Type</Label>
              <Select
                value={formState.type}
                onValueChange={(value) =>
                  setFormState((prev) => ({ ...prev, type: value as Notice['type'] }))
                }
              >
                <SelectTrigger id="notice-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  <SelectItem value="INCIDENT">Incident</SelectItem>
                  <SelectItem value="KNOWN_ISSUE">Known Issue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notice-severity">Severity</Label>
              <Select
                value={formState.severity}
                onValueChange={(value) =>
                  setFormState((prev) => ({ ...prev, severity: value as Notice['severity'] }))
                }
              >
                <SelectTrigger id="notice-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INFO">Info</SelectItem>
                  <SelectItem value="WARN">Warning</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notice-title">Title</Label>
            <Input
              id="notice-title"
              value={formState.title}
              onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notice-body">Body</Label>
            <Textarea
              id="notice-body"
              value={formState.body}
              onChange={(event) => setFormState((prev) => ({ ...prev, body: event.target.value }))}
              rows={4}
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="notice-site">Site Scope</Label>
              <Select
                value={formState.siteId || 'all'}
                onValueChange={(value) =>
                  setFormState((prev) => ({ ...prev, siteId: value === 'all' ? '' : value }))
                }
              >
                <SelectTrigger id="notice-site">
                  <SelectValue placeholder="All sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sites</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 pt-7">
              <Checkbox
                checked={formState.isActive}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({ ...prev, isActive: checked === true }))
                }
              />
              <span className="text-sm">Active</span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="notice-start">Starts At</Label>
              <Input
                id="notice-start"
                type="datetime-local"
                value={formState.startsAt}
                onChange={(event) => setFormState((prev) => ({ ...prev, startsAt: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notice-end">Ends At</Label>
              <Input
                id="notice-end"
                type="datetime-local"
                value={formState.endsAt}
                onChange={(event) => setFormState((prev) => ({ ...prev, endsAt: event.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Notice'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
