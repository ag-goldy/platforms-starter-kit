'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mergeTicketsAction, getMergeableTicketsAction } from '@/app/app/actions/merges';
import { useRouter } from 'next/navigation';

interface MergeTicketDialogProps {
  ticketId: string;
  ticketKey: string;
  onClose: () => void;
}

export function MergeTicketDialog({ ticketId, ticketKey, onClose }: MergeTicketDialogProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeableTickets, setMergeableTickets] = useState<
    Array<{ id: string; key: string; subject: string; status: string }>
  >([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');

  useEffect(() => {
    async function loadTickets() {
      try {
        const tickets = await getMergeableTicketsAction(ticketId);
        setMergeableTickets(tickets);
      } catch {
        setError('Failed to load tickets');
      } finally {
        setIsLoading(false);
      }
    }
    loadTickets();
  }, [ticketId]);

  const handleMerge = async () => {
    if (!selectedTicketId) {
      setError('Please select a ticket to merge into');
      return;
    }

    setIsMerging(true);
    setError(null);

    try {
      await mergeTicketsAction(ticketId, selectedTicketId);
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge tickets');
    } finally {
      setIsMerging(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <div className="py-4">Loading tickets...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge Ticket</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Merge ticket <strong>{ticketKey}</strong> into another ticket. All comments and tags
            will be moved to the target ticket.
          </p>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {mergeableTickets.length === 0 ? (
            <p className="text-sm text-gray-500">No mergeable tickets found.</p>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Merge into ticket:</label>
                <Select value={selectedTicketId} onValueChange={setSelectedTicketId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a ticket..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mergeableTickets.map((ticket) => (
                      <SelectItem key={ticket.id} value={ticket.id}>
                        {ticket.key} - {ticket.subject} ({ticket.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                <strong>Warning:</strong> This action cannot be undone. The source ticket will be
                marked as merged and all its content will be moved to the target ticket.
              </div>

              <div className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleMerge}
                  disabled={!selectedTicketId || isMerging}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isMerging ? 'Merging...' : 'Merge Tickets'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
