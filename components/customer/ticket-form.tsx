'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { createCustomerTicketWithAttachmentsAction } from '@/app/s/[subdomain]/actions/tickets';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { FormError } from '@/components/ui/form-error';
import { formatErrorMessage } from '@/lib/utils/errors';
import { type InferSelectModel } from 'drizzle-orm';
import { services } from '@/db/schema';

type Service = InferSelectModel<typeof services>;

interface CustomerTicketFormProps {
  subdomain: string;
  services?: Service[];
  defaultServiceId?: string;
}

export function CustomerTicketForm({ subdomain, services = [], defaultServiceId }: CustomerTicketFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('P3');
  const [serviceId, setServiceId] = useState<string>(defaultServiceId || '');
  const [cc, setCc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setError('Subject and description are required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setAttachmentError(null);

    try {
      const formData = new FormData();
      formData.append('subject', subject);
      formData.append('description', description);
      formData.append('priority', priority);
      formData.append('subdomain', subdomain);
      if (cc.trim()) {
        formData.append('cc', cc);
      }
      if (serviceId && serviceId !== 'none') {
        formData.append('serviceId', serviceId);
      }

      const files = fileInputRef.current?.files;
      if (files && files.length > 0) {
        const maxBytes = 10 * 1024 * 1024;
        for (const file of Array.from(files)) {
          if (file.size > maxBytes) {
            setAttachmentError('Each file must be 10MB or smaller.');
            setIsSubmitting(false);
            return;
          }
          formData.append('attachments', file);
        }
      }

      const result = await createCustomerTicketWithAttachmentsAction(formData);

      if (result.error) {
        setError(result.error);
        showToast(result.error, 'error');
      } else {
        showToast('Ticket created successfully', 'success');
        router.push(`/s/${subdomain}/tickets/${result.ticketId}`);
      }
    } catch (err) {
      const errorMessage = formatErrorMessage(err);
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormError error={error} />
          
          {services.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="service">Related Service (Optional)</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger id="service">
                  <SelectValue placeholder="Select a service..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of your issue"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide details about your issue..."
              rows={6}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc">CC (optional)</Label>
            <Input
              id="cc"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="attachments">Attachments (optional)</Label>
            <input
              ref={fileInputRef}
              id="attachments"
              name="attachments"
              type="file"
              multiple
              className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
            />
            <p className="text-xs text-gray-500">Up to 10MB per file.</p>
            <FormError error={attachmentError} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="P1">P1 - Critical (System down, data loss)</SelectItem>
                <SelectItem value="P2">P2 - High (Major impact, urgent)</SelectItem>
                <SelectItem value="P3">P3 - Medium (Normal priority)</SelectItem>
                <SelectItem value="P4">P4 - Low (Minor issue, enhancement)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Creating...' : 'Create Ticket'}
            </Button>
            <Link href={`/s/${subdomain}/tickets`}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
