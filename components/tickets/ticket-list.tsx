import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Ticket } from '@/db/schema';

interface TicketListProps {
  tickets: (Ticket & {
    organization: { name: string };
    requester: { name: string | null; email: string } | null;
    assignee: { name: string | null; email: string } | null;
  })[];
  basePath?: string;
}

export function TicketList({ tickets, basePath = '/app/tickets' }: TicketListProps) {
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
    <div className="space-y-2">
      {tickets.map((ticket) => (
        <Link
          key={ticket.id}
          href={`${basePath}/${ticket.id}`}
          className="block rounded-lg border bg-white p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold text-gray-900">
                  {ticket.key}
                </span>
                <Badge className={getStatusColor(ticket.status)}>
                  {ticket.status}
                </Badge>
                <Badge className={getPriorityColor(ticket.priority)}>
                  {ticket.priority}
                </Badge>
              </div>
              <h3 className="font-medium text-gray-900">{ticket.subject}</h3>
              <p className="text-sm text-gray-600 line-clamp-2">
                {ticket.description}
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{ticket.organization.name}</span>
                <span>
                  {ticket.requester?.name || ticket.requester?.email || 'Unknown'}
                </span>
                {ticket.assignee && (
                  <span>Assigned to {ticket.assignee.name || ticket.assignee.email}</span>
                )}
                <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

