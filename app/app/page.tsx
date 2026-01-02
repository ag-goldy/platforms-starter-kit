import { requireInternalRole } from '@/lib/auth/permissions';
import { getTickets, type TicketPriority, type TicketStatus } from '@/lib/tickets/queries';
import { ticketPriorityEnum, ticketStatusEnum } from '@/db/schema';
import { getOrganizations } from '@/lib/organizations/queries';
import { getInternalUsers } from '@/lib/users/queries';
import { TicketList } from '@/components/tickets/ticket-list';
import { TicketFilters } from '@/components/tickets/ticket-filters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    orgId?: string;
    priority?: string;
    assigneeId?: string;
    search?: string;
  }>;
}) {
  await requireInternalRole();
  const params = await searchParams;

  const allowedStatuses = ticketStatusEnum.enumValues;
  const allowedPriorities = ticketPriorityEnum.enumValues;

  const statusValue =
    params.status && allowedStatuses.includes(params.status as TicketStatus)
      ? (params.status as TicketStatus)
      : undefined;
  const priorityValue =
    params.priority && allowedPriorities.includes(params.priority as TicketPriority)
      ? (params.priority as TicketPriority)
      : undefined;

  const filters = {
    status: statusValue ? [statusValue] : undefined,
    orgId: params.orgId,
    priority: priorityValue ? [priorityValue] : undefined,
    assigneeId: params.assigneeId === 'unassigned' ? null : params.assigneeId,
    search: params.search,
  };

  const [ticketList, organizations, internalUsers] = await Promise.all([
    getTickets(filters),
    getOrganizations(),
    getInternalUsers(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ticket Queue</h1>
        <Link href="/app/tickets/new">
          <Button>New Ticket</Button>
        </Link>
      </div>

      <TicketFilters
        organizations={organizations}
        internalUsers={internalUsers}
        initialFilters={{
          status: params.status,
          priority: params.priority,
          orgId: params.orgId,
          assigneeId: params.assigneeId,
          search: params.search,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>All Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <TicketList tickets={ticketList} />
        </CardContent>
      </Card>
    </div>
  );
}
