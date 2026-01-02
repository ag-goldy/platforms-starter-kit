'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TicketFiltersProps {
  organizations: { id: string; name: string }[];
  internalUsers: { id: string; name: string | null; email: string }[];
  initialFilters: {
    status?: string;
    priority?: string;
    orgId?: string;
    assigneeId?: string;
    search?: string;
  };
}

export function TicketFilters({
  organizations,
  internalUsers,
  initialFilters,
}: TicketFiltersProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialFilters.search || '');
  const [status, setStatus] = useState(initialFilters.status || 'all');
  const [priority, setPriority] = useState(initialFilters.priority || 'all');
  const [orgId, setOrgId] = useState(initialFilters.orgId || 'all');
  const [assigneeId, setAssigneeId] = useState(initialFilters.assigneeId || 'all');

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();

    if (search.trim()) params.set('search', search.trim());
    if (status !== 'all') params.set('status', status);
    if (priority !== 'all') params.set('priority', priority);
    if (orgId !== 'all') params.set('orgId', orgId);
    if (assigneeId !== 'all') params.set('assigneeId', assigneeId);

    const query = params.toString();
    router.push(query ? `/app?${query}` : '/app');
  }

  function clearFilters() {
    setSearch('');
    setStatus('all');
    setPriority('all');
    setOrgId('all');
    setAssigneeId('all');
    router.push('/app');
  }

  return (
    <form onSubmit={applyFilters} className="space-y-4 rounded-lg border bg-white p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Subject, description, key..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status-filter">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="NEW">New</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="WAITING_ON_CUSTOMER">Waiting on Customer</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority-filter">Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger id="priority-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="P1">P1</SelectItem>
              <SelectItem value="P2">P2</SelectItem>
              <SelectItem value="P3">P3</SelectItem>
              <SelectItem value="P4">P4</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-filter">Organization</Label>
          <Select value={orgId} onValueChange={setOrgId}>
            <SelectTrigger id="org-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assignee-filter">Assignee</Label>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger id="assignee-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {internalUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name || user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit">Apply Filters</Button>
        <Button type="button" variant="outline" onClick={clearFilters}>
          Clear
        </Button>
      </div>
    </form>
  );
}
