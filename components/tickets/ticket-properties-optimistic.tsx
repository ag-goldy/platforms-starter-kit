'use client';

import { useTransition, useOptimistic } from 'react';
import { updateTicketStatus, updateTicketPriority } from '@/app/app/actions/tickets';

export function TicketPropertiesOptimistic({
  ticketId,
  orgId,
  initialStatus,
  initialPriority,
  initialType,
}: {
  ticketId: string;
  orgId: string;
  initialStatus: string;
  initialPriority: string;
  initialType: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, addOptimisticStatus] = useOptimistic(initialStatus);
  const [optimisticPriority, addOptimisticPriority] = useOptimistic(initialPriority);

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    startTransition(async () => {
      addOptimisticStatus(newStatus);
      await updateTicketStatus(ticketId, orgId, newStatus);
    });
  };

  const handlePriorityChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPriority = e.target.value;
    startTransition(async () => {
      addOptimisticPriority(newPriority);
      await updateTicketPriority(ticketId, orgId, newPriority);
    });
  };

  return (
    <dl className="space-y-4 text-sm">
      <div className="flex flex-col gap-1">
        <dt className="text-muted-foreground">Status</dt>
        <dd>
          <select 
            value={optimisticStatus} 
            onChange={handleStatusChange}
            className="w-full p-2 border rounded-md"
          >
            <option value="new">New</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="on_hold">On Hold</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </dd>
      </div>
      
      <div className="flex flex-col gap-1">
        <dt className="text-muted-foreground">Priority</dt>
        <dd>
          <select 
            value={optimisticPriority} 
            onChange={handlePriorityChange}
            className="w-full p-2 border rounded-md"
          >
            <option value="p1">P1 - Critical</option>
            <option value="p2">P2 - High</option>
            <option value="p3">P3 - Medium</option>
            <option value="p4">P4 - Low</option>
          </select>
        </dd>
      </div>

      <div className="flex flex-col gap-1">
        <dt className="text-muted-foreground">Type</dt>
        <dd className="font-medium p-2">{initialType}</dd>
      </div>
    </dl>
  );
}
