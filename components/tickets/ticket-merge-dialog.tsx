'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { Loader2, Search, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface TicketMergeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTicket: {
    id: string;
    key: string;
    subject: string;
    orgId: string;
  };
}

interface TicketResult {
  id: string;
  key: string;
  subject: string;
  status: string;
  createdAt: string;
}

export function TicketMergeDialog({ isOpen, onClose, sourceTicket }: TicketMergeDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TicketResult[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [preview, setPreview] = useState<{ comments: number; attachments: number } | null>(null);
  const { success, error: showError } = useToast();
  const router = useRouter();

  const searchTickets = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/tickets/search?orgId=${sourceTicket.orgId}&q=${encodeURIComponent(query)}&exclude=${sourceTicket.id}`
      );
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      setSearchResults(data.tickets || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [sourceTicket.orgId, sourceTicket.id]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      searchTickets(searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, searchTickets]);

  const handleSelectTicket = async (ticket: TicketResult) => {
    setSelectedTicket(ticket);
    
    // Fetch preview data (comments and attachments count)
    try {
      const response = await fetch(`/api/tickets/${sourceTicket.id}/stats`);
      if (response.ok) {
        const data = await response.json();
        setPreview(data);
      }
    } catch (err) {
      console.error('Failed to fetch preview:', err);
    }
  };

  const handleMerge = async () => {
    if (!selectedTicket) return;

    setIsMerging(true);
    try {
      const response = await fetch(`/api/tickets/${sourceTicket.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTicketId: selectedTicket.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Merge failed');
      }

      const result = await response.json();
      success(`Ticket ${sourceTicket.key} merged into ${selectedTicket.key}`);
      
      // Close dialog and redirect to target ticket
      onClose();
      router.push(`/app/tickets/${selectedTicket.id}`);
      router.refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to merge tickets');
      setIsMerging(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge Ticket</DialogTitle>
          <DialogDescription>
            Merge <strong>{sourceTicket.key}</strong> into another ticket. 
            All comments, attachments, and linked assets will be moved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Source Ticket Info */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Source</span>
              <ArrowRight className="w-4 h-4" />
              <span className="font-mono text-gray-900">{sourceTicket.key}</span>
            </div>
            <p className="mt-1 text-sm truncate">{sourceTicket.subject}</p>
          </div>

          {/* Search */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Search Target Ticket</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ticket key or subject..."
                className="pl-9"
              />
            </div>

            {isSearching && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching...
              </div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && !selectedTicket && (
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {searchResults.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket)}
                    className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">{ticket.key}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {ticket.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{ticket.subject}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Target */}
          {selectedTicket && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span className="font-mono text-sm">{selectedTicket.key}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedTicket(null);
                    setPreview(null);
                  }}
                >
                  Change
                </Button>
              </div>
              <p className="mt-1 text-sm text-gray-600 truncate">{selectedTicket.subject}</p>
              
              {preview && (
                <div className="mt-2 text-xs text-gray-500">
                  This will move {preview.comments} comments and {preview.attachments} attachments
                </div>
              )}
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-amber-800">
              <p className="font-medium">Important</p>
              <p className="text-xs mt-1">
                The source ticket will be closed with status &quot;MERGED&quot; and linked to the target ticket. 
                This action cannot be undone.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isMerging}>
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!selectedTicket || isMerging}
          >
            {isMerging ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Merging...
              </>
            ) : (
              'Merge Tickets'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
