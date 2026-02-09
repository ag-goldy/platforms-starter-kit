'use client';

import { useState, useEffect } from 'react';
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
import { getAllTagsAction } from '@/app/app/actions/tags';
import { getSavedSearchesAction, saveSearchAction, deleteSavedSearchAction } from '@/app/app/actions/searches';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, X, Bookmark } from 'lucide-react';
import type { TicketTag } from '@/db/schema';
import type { TicketFilters, TicketStatus, TicketPriority } from '@/lib/tickets/queries';

interface TicketFiltersProps {
  organizations: { id: string; name: string }[];
  internalUsers: { id: string; name: string | null; email: string }[];
  initialFilters: {
    status?: string;
    priority?: string;
    orgId?: string;
    assigneeId?: string;
    search?: string;
    tagIds?: string;
    dateFrom?: string;
    dateTo?: string;
    searchInComments?: string;
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
  const [tags, setTags] = useState<TicketTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    initialFilters.tagIds ? initialFilters.tagIds.split(',') : []
  );
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom || '');
  const [dateTo, setDateTo] = useState(initialFilters.dateTo || '');
  const [searchInComments, setSearchInComments] = useState(
    initialFilters.searchInComments === 'true'
  );
  const [savedSearches, setSavedSearches] = useState<
    Array<{ id: string; name: string; filters: TicketFilters }>
  >([]);
  const [showSaveSearch, setShowSaveSearch] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');

  useEffect(() => {
    async function loadTags() {
      try {
        const allTags = await getAllTagsAction();
        setTags(allTags);
      } catch (error) {
        console.error('Failed to load tags:', error);
      }
    }
    loadTags();
  }, []);

  useEffect(() => {
    async function loadSavedSearches() {
      try {
        const searches = await getSavedSearchesAction();
        setSavedSearches(searches);
      } catch (error) {
        console.error('Failed to load saved searches:', error);
      }
    }
    loadSavedSearches();
  }, []);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();

    if (search.trim()) params.set('search', search.trim());
    if (status !== 'all') params.set('status', status);
    if (priority !== 'all') params.set('priority', priority);
    if (orgId !== 'all') params.set('orgId', orgId);
    if (assigneeId !== 'all') params.set('assigneeId', assigneeId);
    if (selectedTagIds.length > 0) params.set('tagIds', selectedTagIds.join(','));
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (searchInComments) params.set('searchInComments', 'true');

    const query = params.toString();
    router.push(query ? `/app/tickets?${query}` : '/app/tickets');
  }

  function clearFilters() {
    setSearch('');
    setStatus('all');
    setPriority('all');
    setOrgId('all');
    setAssigneeId('all');
    setSelectedTagIds([]);
    setDateFrom('');
    setDateTo('');
    setSearchInComments(false);
    router.push('/app/tickets');
  }

  async function handleSaveSearch() {
    if (!saveSearchName.trim()) return;

    const filters = {
      search: search.trim() || undefined,
      status: status !== 'all' ? [status as TicketStatus] : undefined,
      priority: priority !== 'all' ? [priority as TicketPriority] : undefined,
      orgId: orgId !== 'all' ? orgId : undefined,
      assigneeId: assigneeId !== 'all' ? assigneeId : undefined,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      searchInComments: searchInComments || undefined,
    };

    try {
      await saveSearchAction(saveSearchName.trim(), filters);
      setShowSaveSearch(false);
      setSaveSearchName('');
      const searches = await getSavedSearchesAction();
      setSavedSearches(searches);
    } catch (error) {
      console.error('Failed to save search:', error);
    }
  }

  async function handleLoadSavedSearch(savedSearch: typeof savedSearches[0]) {
    const filters = savedSearch.filters;
    setSearch(filters.search || '');
    setStatus(filters.status?.[0] || 'all');
    setPriority(filters.priority?.[0] || 'all');
    setOrgId(filters.orgId || 'all');
    setAssigneeId(filters.assigneeId || 'all');
    setSelectedTagIds(filters.tagIds || []);
    setDateFrom(filters.dateFrom ? new Date(filters.dateFrom).toISOString().split('T')[0] : '');
    setDateTo(filters.dateTo ? new Date(filters.dateTo).toISOString().split('T')[0] : '');
    setSearchInComments(filters.searchInComments || false);

    // Apply the filters
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status?.length) params.set('status', filters.status[0]);
    if (filters.priority?.length) params.set('priority', filters.priority[0]);
    if (filters.orgId) params.set('orgId', filters.orgId);
    if (filters.assigneeId) params.set('assigneeId', filters.assigneeId);
    if (filters.tagIds?.length) params.set('tagIds', filters.tagIds.join(','));
    if (filters.dateFrom) params.set('dateFrom', new Date(filters.dateFrom).toISOString().split('T')[0]);
    if (filters.dateTo) params.set('dateTo', new Date(filters.dateTo).toISOString().split('T')[0]);
    if (filters.searchInComments) params.set('searchInComments', 'true');

    router.push(`/app/tickets?${params.toString()}`);
  }

  async function handleDeleteSavedSearch(searchId: string) {
    try {
      await deleteSavedSearchAction(searchId);
      const searches = await getSavedSearchesAction();
      setSavedSearches(searches);
    } catch (error) {
      console.error('Failed to delete saved search:', error);
    }
  }

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <form onSubmit={applyFilters} className="space-y-4 rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Filters</h2>
        <div className="flex gap-2">
          {savedSearches.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" type="button">
                  <Bookmark className="h-4 w-4 mr-2" />
                  Saved Searches
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-2">
                  <div className="font-semibold text-sm mb-2">Saved Searches</div>
                  {savedSearches.map((saved) => (
                    <div
                      key={saved.id}
                      className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
                    >
                      <button
                        type="button"
                        onClick={() => handleLoadSavedSearch(saved)}
                        className="flex-1 text-left text-sm"
                      >
                        {saved.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedSearch(saved.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Popover open={showSaveSearch} onOpenChange={setShowSaveSearch}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" type="button">
                <Search className="h-4 w-4 mr-2" />
                Save Search
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <div className="space-y-3">
                <Label htmlFor="save-search-name">Search Name</Label>
                <Input
                  id="save-search-name"
                  value={saveSearchName}
                  onChange={(e) => setSaveSearchName(e.target.value)}
                  placeholder="e.g., My Open Tickets"
                />
                <Button onClick={handleSaveSearch} size="sm" className="w-full">
                  Save
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="search">Search</Label>
          <div className="space-y-2">
            <Input
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Subject, description, key, comments..."
            />
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={searchInComments}
                onChange={(e) => setSearchInComments(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>Also search in comments</span>
            </label>
          </div>
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

      {tags.length > 0 && (
        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  selectedTagIds.includes(tag.id)
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
                style={
                  selectedTagIds.includes(tag.id)
                    ? {}
                    : { borderColor: tag.color, color: tag.color }
                }
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date-from">Date From</Label>
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date-to">Date To</Label>
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
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
