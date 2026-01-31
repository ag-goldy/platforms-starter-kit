'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ticket } from '@/db/schema';
import { BulkActions } from './bulk-actions';
import { formatDate } from '@/lib/utils/date';
import { SearchHighlight } from './search-highlight';
import { assignToMeAction, replyAndWaitingAction, closeAndSendCSATAction } from '@/app/app/actions/fast-actions';
import { UserPlus, MessageSquare, CheckCircle } from 'lucide-react';

interface TicketListProps {
  tickets: (Ticket & {
    organization: { name: string };
    requester: { name: string | null; email: string } | null;
    assignee: { id: string; name: string | null; email: string } | null;
    tagAssignments?: Array<{
      tag: { id: string; name: string; color: string };
    }>;
  })[];
  basePath?: string;
  internalUsers?: { id: string; name: string | null; email: string }[];
  searchTerm?: string;
  currentUserId?: string;
}

export function TicketList({ tickets, basePath = '/app/tickets', internalUsers, searchTerm, currentUserId }: TicketListProps) {
  const router = useRouter();
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [processingTicketId, setProcessingTicketId] = useState<string | null>(null);

  const toggleSelection = (ticketId: string) => {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTicketIds.size === tickets.length) {
      setSelectedTicketIds(new Set());
    } else {
      setSelectedTicketIds(new Set(tickets.map((t) => t.id)));
    }
  };

  if (tickets.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500">
        No tickets found. Create a new ticket to get started.
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW':
        return 'bg-blue-100 text-blue-800';
      case 'OPEN':
        return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800';
      case 'RESOLVED':
        return 'bg-gray-100 text-gray-800';
      case 'CLOSED':
        return 'bg-gray-200 text-gray-900';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P1':
        return 'bg-red-100 text-red-800';
      case 'P2':
        return 'bg-orange-100 text-orange-800';
      case 'P3':
        return 'bg-yellow-100 text-yellow-800';
      case 'P4':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {selectedTicketIds.size > 0 && internalUsers && (
        <BulkActions
          selectedTicketIds={Array.from(selectedTicketIds)}
          onClearSelection={() => setSelectedTicketIds(new Set())}
          internalUsers={internalUsers}
        />
      )}

    <div className="space-y-2">
        {tickets.length > 0 && internalUsers && (
          <div className="flex items-center gap-2 pb-2 border-b">
            <input
              type="checkbox"
              checked={selectedTicketIds.size === tickets.length}
              onChange={toggleSelectAll}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">
              Select all ({selectedTicketIds.size} selected)
            </span>
          </div>
        )}

      {tickets.map((ticket) => (
          <div
            key={ticket.id}
            className={`flex items-start gap-3 rounded-lg border bg-white p-4 transition-colors ${
              selectedTicketIds.has(ticket.id) ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
            }`}
          >
            {internalUsers && (
              <input
                type="checkbox"
                checked={selectedTicketIds.has(ticket.id)}
                onChange={() => toggleSelection(ticket.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 rounded border-gray-300"
              />
            )}
        <Link
          href={`${basePath}/${ticket.id}`}
              className="flex-1 space-y-2"
        >
              <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                <span className="font-mono text-xs md:text-sm font-semibold text-gray-900">
                  {ticket.key}
                </span>
                <Badge className={getStatusColor(ticket.status)}>
                  {ticket.status}
                </Badge>
                <Badge className={getPriorityColor(ticket.priority)}>
                  {ticket.priority}
                </Badge>
                {ticket.tagAssignments && ticket.tagAssignments.length > 0 && (
                  <>
                    {ticket.tagAssignments.map((assignment: { tag: { id: string; name: string; color: string | null } }) => (
                      <Badge
                        key={assignment.tag.id}
                        className="text-xs"
                        style={{
                          backgroundColor: assignment.tag.color ? `${assignment.tag.color}20` : undefined,
                          color: assignment.tag.color || undefined,
                        }}
                      >
                        {assignment.tag.name}
                      </Badge>
                    ))}
                  </>
                )}
              </div>
              <h3 className="font-medium text-gray-900">
                {searchTerm ? (
                  <SearchHighlight text={ticket.subject} searchTerm={searchTerm} />
                ) : (
                  ticket.subject
                )}
              </h3>
              <p className="text-sm text-gray-600 line-clamp-2">
                {searchTerm ? (
                  <SearchHighlight text={ticket.description} searchTerm={searchTerm} />
                ) : (
                  ticket.description
                )}
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{ticket.organization.name}</span>
                <span>
                  {ticket.requester?.name || ticket.requester?.email || 'Unknown'}
                </span>
                {ticket.assignee && (
                  <span>Assigned to {ticket.assignee.name || ticket.assignee.email}</span>
                )}
                <span>{formatDate(ticket.createdAt)}</span>
              </div>
            </Link>
            {internalUsers && currentUserId && (
              <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                {ticket.assignee?.id !== currentUserId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setProcessingTicketId(ticket.id);
                      try {
                        await assignToMeAction(ticket.id);
                        router.refresh();
                      } catch (error) {
                        alert(error instanceof Error ? error.message : 'Failed to assign ticket');
                      } finally {
                        setProcessingTicketId(null);
                      }
                    }}
                    disabled={processingTicketId === ticket.id}
                    title="Assign to me"
                    className="h-7 px-2 text-xs"
                  >
                    <UserPlus className="h-3 w-3" />
                  </Button>
                )}
                {ticket.status !== 'WAITING_ON_CUSTOMER' && ticket.status !== 'CLOSED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const comment = prompt('Add a comment (this will set status to Waiting):');
                      if (!comment) return;
                      setProcessingTicketId(ticket.id);
                      try {
                        await replyAndWaitingAction(ticket.id, comment);
                        router.refresh();
                      } catch (error) {
                        alert(error instanceof Error ? error.message : 'Failed to update ticket');
                      } finally {
                        setProcessingTicketId(null);
                      }
                    }}
                    disabled={processingTicketId === ticket.id}
                    title="Reply + Waiting"
                    className="h-7 px-2 text-xs"
                  >
                    <MessageSquare className="h-3 w-3" />
                  </Button>
                )}
                {ticket.status !== 'CLOSED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (!confirm('Close this ticket?')) return;
                      setProcessingTicketId(ticket.id);
                      try {
                        await closeAndSendCSATAction(ticket.id);
                        router.refresh();
                      } catch (error) {
                        alert(error instanceof Error ? error.message : 'Failed to close ticket');
                      } finally {
                        setProcessingTicketId(null);
                      }
                    }}
                    disabled={processingTicketId === ticket.id}
                    title="Close + CSAT"
                    className="h-7 px-2 text-xs"
                  >
                    <CheckCircle className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
      ))}
      </div>
    </div>
  );
}

