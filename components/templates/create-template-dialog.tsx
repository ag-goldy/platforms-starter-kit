'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { createTemplateAction } from '@/app/app/actions/templates';
import { useRouter } from 'next/navigation';

interface CreateTemplateDialogProps {
  onClose: () => void;
}

export function CreateTemplateDialog({ onClose }: CreateTemplateDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    content: '',
    internalOnly: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createTemplateAction(formData);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Ticket Template</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Password Reset Response"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject Template</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="e.g., Re: {{ticket.subject}}"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content Template</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Enter template content..."
              rows={10}
              required
            />
            <p className="text-xs text-gray-500">
              You can use placeholders like {'{'}ticket.subject{'}'} or {'{'}requester.name{'}'}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="internalOnly"
                checked={formData.internalOnly}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, internalOnly: checked === true })
                }
              />
              <Label htmlFor="internalOnly" className="text-sm font-normal cursor-pointer">
                Internal only (not visible to customers)
              </Label>
            </div>
            <p className="text-xs text-gray-500 ml-6">
              Internal templates are only available to agents, not in customer-facing emails
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Template'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

