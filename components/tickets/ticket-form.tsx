'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { createTicketAction } from '@/app/app/actions/tickets';

interface TicketFormProps {
  organizations: { id: string; name: string; subdomain: string }[];
  internalUsers: { id: string; name: string | null; email: string }[];
  sites: { id: string; orgId: string; name: string }[];
  areas: { id: string; siteId: string; name: string }[];
}

export function TicketForm({ organizations, internalUsers, sites, areas }: TicketFormProps) {
  const router = useRouter();
  const defaultOrgId = useMemo(() => organizations[0]?.id || '', [organizations]);
  const [orgId, setOrgId] = useState(defaultOrgId);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('P3');
  const [category, setCategory] = useState('INCIDENT');
  const [assigneeId, setAssigneeId] = useState('unassigned');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [siteId, setSiteId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [siteSearch, setSiteSearch] = useState('');
  const [areaSearch, setAreaSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSiteId('');
    setAreaId('');
    setSiteSearch('');
    setAreaSearch('');
  }, [orgId]);

  const filteredSites = useMemo(() => {
    const orgSites = sites.filter((site) => site.orgId === orgId);
    const term = siteSearch.trim().toLowerCase();
    if (!term) return orgSites;
    return orgSites.filter((site) => site.name.toLowerCase().includes(term));
  }, [orgId, siteSearch, sites]);

  const filteredAreas = useMemo(() => {
    const orgSiteIds = sites.filter((site) => site.orgId === orgId).map((site) => site.id);
    const scopedAreas = areas.filter((area) =>
      siteId ? area.siteId === siteId : orgSiteIds.includes(area.siteId)
    );
    const term = areaSearch.trim().toLowerCase();
    if (!term) return scopedAreas;
    return scopedAreas.filter((area) => area.name.toLowerCase().includes(term));
  }, [areas, areaSearch, orgId, siteId, sites]);

  if (organizations.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm text-gray-600">
            You need at least one organization before creating tickets.
          </p>
          <Link href="/app/organizations/new">
            <Button>Create Organization</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !description.trim() || !orgId) {
      setError('Organization, subject, and description are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createTicketAction({
        orgId,
        subject,
        description,
        priority,
        category,
        assigneeId: assigneeId === 'unassigned' ? null : assigneeId,
        requesterEmail: requesterEmail.trim() || null,
        siteId: siteId || null,
        areaId: areaId || null,
      });

      if (result.error) {
        setError(result.error);
      } else {
        router.push(`/app/tickets/${result.ticketId}`);
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
            <Label htmlFor="org">Organization</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger id="org">
                <SelectValue placeholder="Select an organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name} ({org.subdomain})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of the issue"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details about the request..."
              rows={6}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
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

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
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
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="assignee">Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger id="assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {internalUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requesterEmail">Requester Email (optional)</Label>
              <Input
                id="requesterEmail"
                value={requesterEmail}
                onChange={(e) => setRequesterEmail(e.target.value)}
                placeholder="customer@example.com"
                type="email"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="siteSearch">Site (optional)</Label>
              <Input
                id="siteSearch"
                value={siteSearch}
                onChange={(e) => setSiteSearch(e.target.value)}
                placeholder="Search sites..."
              />
              <select
                value={siteId}
                onChange={(e) => {
                  setSiteId(e.target.value);
                  setAreaId('');
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">No site</option>
                {filteredSites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="areaSearch">Area (optional)</Label>
              <Input
                id="areaSearch"
                value={areaSearch}
                onChange={(e) => setAreaSearch(e.target.value)}
                placeholder="Search areas..."
              />
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">No area</option>
                {filteredAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Ticket'}
            </Button>
            <Link href="/app">
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
