'use client';

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { requestFormSchema } from '@/lib/request-types/validation';
import { RequestFormFields } from '@/components/request-types/request-form-fields';
import { createRequestTypeAction, updateRequestTypeAction } from '@/app/app/actions/request-types';
import { useRouter } from 'next/navigation';
import type { RequestType } from '@/db/schema';
import { slugify } from '@/lib/utils/slug';

interface RequestTypeDialogProps {
  orgId: string;
  onClose: () => void;
  initialData?: RequestType | null;
}

export function RequestTypeDialog({ orgId, onClose, initialData }: RequestTypeDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    description: initialData?.description || '',
    category: initialData?.category || 'SERVICE_REQUEST',
    defaultPriority: initialData?.defaultPriority || 'P3',
    isActive: initialData?.isActive ?? true,
    requiredAttachments: initialData?.requiredAttachments ?? false,
    formSchema: initialData?.formSchema
      ? JSON.stringify(initialData.formSchema, null, 2)
      : JSON.stringify({ fields: [] }, null, 2),
  });

  const parsedSchema = useMemo(() => {
    try {
      const parsed = JSON.parse(formState.formSchema || '{}');
      return requestFormSchema.safeParse(parsed);
    } catch {
      return requestFormSchema.safeParse(null);
    }
  }, [formState.formSchema]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (initialData?.id) {
        await updateRequestTypeAction(orgId, initialData.id, {
          ...formState,
        });
      } else {
        await createRequestTypeAction(orgId, {
          ...formState,
        });
      }

      router.refresh();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save request type');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Request Type' : 'Create Request Type'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formState.name}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setFormState((prev) => ({
                    ...prev,
                    name: nextName,
                    slug: prev.slug ? prev.slug : slugify(nextName),
                  }));
                }}
                placeholder="e.g., VPN Access Request"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={formState.slug}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, slug: slugify(event.target.value) }))
                }
                placeholder="vpn-access"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formState.description}
              onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Short summary shown in the catalog."
              rows={3}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formState.category}
                onValueChange={(value) =>
                  setFormState((prev) => ({ ...prev, category: value as RequestType['category'] }))
                }
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCIDENT">Incident</SelectItem>
                  <SelectItem value="SERVICE_REQUEST">Service Request</SelectItem>
                  <SelectItem value="CHANGE_REQUEST">Change Request</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Default Priority</Label>
              <Select
                value={formState.defaultPriority}
                onValueChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    defaultPriority: value as RequestType['defaultPriority'],
                  }))
                }
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="P1">P1 - Critical</SelectItem>
                  <SelectItem value="P2">P2 - High</SelectItem>
                  <SelectItem value="P3">P3 - Medium</SelectItem>
                  <SelectItem value="P4">P4 - Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={formState.isActive}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({ ...prev, isActive: checked === true }))
                }
              />
              Active
            </label>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={formState.requiredAttachments}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({ ...prev, requiredAttachments: checked === true }))
                }
              />
              Require attachments
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="formSchema">Form Schema (JSON)</Label>
            <Textarea
              id="formSchema"
              value={formState.formSchema}
              onChange={(event) => setFormState((prev) => ({ ...prev, formSchema: event.target.value }))}
              rows={10}
              className="font-mono text-xs"
            />
            <p className="text-xs text-gray-500">
              Define fields with id, label, type, and options. Example: {'{ "fields": [ { "id": "summary", "label": "Summary", "type": "text", "required": true } ] }'}
            </p>
            {!parsedSchema.success && (
              <p className="text-xs text-red-600">Form schema is invalid JSON or does not match the expected shape.</p>
            )}
          </div>

          {parsedSchema.success && (
            <div className="rounded-md border bg-gray-50 p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Preview</h4>
              <RequestFormFields schema={parsedSchema.data} values={{}} onChange={() => {}} disabled />
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Request Type'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
