'use client';

import { useState } from 'react';
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
import { createCustomerTicketAction } from '@/app/s/[subdomain]/actions/tickets';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CustomerTicketFormProps {
  orgId: string;
  subdomain: string;
}

export function CustomerTicketForm({ orgId, subdomain }: CustomerTicketFormProps) {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('P3');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setError('Subject and description are required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createCustomerTicketAction({
        orgId,
        subject,
        description,
        priority,
      });

      if (result.error) {
        setError(result.error);
      } else {
        router.push(`/s/${subdomain}/tickets/${result.ticketId}`);
      }
    } catch {
      setError('Failed to create ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
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
