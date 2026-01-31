'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { Link2, X, Search } from 'lucide-react';
import {
  getTicketLinksAction,
  createTicketLinkAction,
  removeTicketLinkAction,
  searchTicketsForLinkingAction,
} from '@/app/app/actions/ticket-links';
import Link from 'next/link';
import type { LinkType } from '@/lib/tickets/links';
import type { Ticket } from '@/db/schema';

interface TicketLinksProps {
  ticketId: string;
  ticketKey: string;
}

interface LinkedTicket {
  link: {
    id: string;
    linkType: LinkType;
  };
  ticket: Ticket & {
    key: string;
    subject: string;
    status: string;
  } | null;
}

const linkTypeLabels: Record<LinkType, string> = {
  related: 'Related',
  duplicate: 'Duplicate',
  blocks: 'Blocks',
  blocked_by: 'Blocked By',
};

const linkTypeColors: Record<LinkType, string> = {
  related: 'bg-blue-100 text-blue-800',
  duplicate: 'bg-yellow-100 text-yellow-800',
  blocks: 'bg-red-100 text-red-800',
  blocked_by: 'bg-orange-100 text-orange-800',
};

export function TicketLinks({ ticketId, ticketKey }: TicketLinksProps) {
  const { showToast } = useToast();
  const [outgoing, setOutgoing] = useState<LinkedTicket[]>([]);
  const [incoming, setIncoming] = useState<LinkedTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; key: string; subject: string }>
  >([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [selectedLinkType, setSelectedLinkType] = useState<LinkType>('related');
  const [isCreating, setIsCreating] = useState(false);

  const loadLinks = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getTicketLinksAction(ticketId);
      setOutgoing(result.outgoing.filter((item) => item.ticket !== null) as LinkedTicket[]);
      setIncoming(result.incoming.filter((item) => item.ticket !== null) as LinkedTicket[]);
    } catch {
      showToast('Failed to load ticket links', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, ticketId]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  async function handleSearch() {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      // Search tickets by key or subject
      const tickets = await searchTicketsForLinkingAction(searchQuery, ticketId);
      setSearchResults(tickets);
    } catch {
      showToast('Failed to search tickets', 'error');
    }
  }

  async function handleCreateLink() {
    if (!selectedTicketId || !selectedLinkType) {
      showToast('Please select a ticket and link type', 'error');
      return;
    }

    setIsCreating(true);
    try {
      await createTicketLinkAction(ticketId, selectedTicketId, selectedLinkType);
      showToast('Ticket link created successfully', 'success');
      setIsDialogOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedTicketId('');
      setSelectedLinkType('related');
      await loadLinks();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create link', 'error');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRemoveLink(
    targetTicketId: string,
    linkType: LinkType,
    isIncoming: boolean
  ) {
    if (!confirm('Are you sure you want to remove this link?')) {
      return;
    }

    try {
      if (isIncoming) {
        // For incoming links, swap source and target
        await removeTicketLinkAction(targetTicketId, ticketId, linkType);
      } else {
        await removeTicketLinkAction(ticketId, targetTicketId, linkType);
      }
      showToast('Link removed successfully', 'success');
      await loadLinks();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to remove link', 'error');
    }
  }

  const allLinks = [...outgoing, ...incoming];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Linked Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Linked Tickets</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Link2 className="mr-2 h-4 w-4" />
                Link Ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Link Ticket</DialogTitle>
                <DialogDescription>
                  Search for a ticket to link to {ticketKey}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="search">Search Tickets</Label>
                  <div className="flex gap-2">
                    <Input
                      id="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by ticket key or subject..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSearch();
                        }
                      }}
                    />
                    <Button onClick={handleSearch} variant="outline">
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <Label>Select Ticket</Label>
                    <Select value={selectedTicketId} onValueChange={setSelectedTicketId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a ticket..." />
                      </SelectTrigger>
                      <SelectContent>
                        {searchResults.map((ticket) => (
                          <SelectItem key={ticket.id} value={ticket.id}>
                            {ticket.key} - {ticket.subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedTicketId && (
                  <div className="space-y-2">
                    <Label htmlFor="linkType">Link Type</Label>
                    <Select
                      value={selectedLinkType}
                      onValueChange={(value) => setSelectedLinkType(value as LinkType)}
                    >
                      <SelectTrigger id="linkType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="related">Related</SelectItem>
                        <SelectItem value="duplicate">Duplicate</SelectItem>
                        <SelectItem value="blocks">Blocks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateLink} disabled={!selectedTicketId || isCreating}>
                    {isCreating ? 'Linking...' : 'Create Link'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {allLinks.length === 0 ? (
          <p className="text-sm text-gray-500">No linked tickets</p>
        ) : (
          <div className="space-y-3">
            {outgoing.map((item) => {
              if (!item.ticket) return null;
              return (
                <div
                  key={item.link.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={linkTypeColors[item.link.linkType]}>
                      {linkTypeLabels[item.link.linkType]}
                    </Badge>
                    <Link
                      href={`/app/tickets/${item.ticket.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {item.ticket.key}
                    </Link>
                    <span className="text-sm text-gray-600">{item.ticket.subject}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleRemoveLink(item.ticket!.id, item.link.linkType, false)
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            {incoming.map((item) => {
              if (!item.ticket) return null;
              return (
                <div
                  key={item.link.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={linkTypeColors[item.link.linkType]}>
                      {linkTypeLabels[item.link.linkType]}
                    </Badge>
                    <Link
                      href={`/app/tickets/${item.ticket.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {item.ticket.key}
                    </Link>
                    <span className="text-sm text-gray-600">{item.ticket.subject}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleRemoveLink(item.ticket!.id, item.link.linkType, true)
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
