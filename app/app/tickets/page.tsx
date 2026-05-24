import { requireInternalRole } from "@/lib/auth/permissions";
import {
  getTickets,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/tickets/queries";
import { ticketPriorityEnum, ticketStatusEnum, Ticket } from "@/db/schema";

interface TicketWithRelations extends Ticket {
  organization: { id: string; name: string } | null;
  requestType?: { id: string; name: string; slug: string } | null;
  site?: { id: string; name: string; slug: string } | null;
  area?: { id: string; name: string; slug: string } | null;
  requester: { id: string; name: string | null; email: string } | null;
  assignee: { id: string; name: string | null; email: string } | null;
  tagAssignments?: Array<{
    tag: { id: string; name: string; color: string | null };
  }>;
}
import { getOrganizations } from "@/lib/organizations/queries";
import { getInternalUsers } from "@/lib/users/queries";
import { TicketList } from "@/components/tickets/ticket-list";
import { TicketFilters } from "@/components/tickets/ticket-filters";
import { TicketToolbar } from "@/components/tickets/ticket-toolbar";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus } from "lucide-react";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    orgId?: string;
    priority?: string;
    assigneeId?: string;
    search?: string;
    tagIds?: string;
    dateFrom?: string;
    dateTo?: string;
    searchInComments?: string;
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
    params.priority &&
    allowedPriorities.includes(params.priority as TicketPriority)
      ? (params.priority as TicketPriority)
      : undefined;

  const filters = {
    status: statusValue ? [statusValue] : undefined,
    orgId: params.orgId,
    publicIntake: params.orgId === "public",
    priority: priorityValue ? [priorityValue] : undefined,
    assigneeId: params.assigneeId === "unassigned" ? null : params.assigneeId,
    search: params.search,
    tagIds: params.tagIds ? params.tagIds.split(",") : undefined,
    dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
    dateTo: params.dateTo ? new Date(params.dateTo) : undefined,
    searchInComments: params.searchInComments === "true",
  };

  const [ticketList, organizations, internalUsers] = await Promise.all([
    getTickets(filters),
    getOrganizations(),
    getInternalUsers(),
  ]);

  const user = await requireInternalRole();

  const activeFilterCount = [
    params.status,
    params.priority,
    params.orgId,
    params.assigneeId,
    params.search,
    params.tagIds,
    params.dateFrom,
    params.dateTo,
    params.searchInComments,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Tickets</h1>
        <Button asChild size="sm">
          <Link href="/app/tickets/new">
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            New
          </Link>
        </Button>
      </div>

      {/* Toolbar: search, quick views, collapsible filters */}
      <TicketToolbar
        currentUserId={user.user.id}
        activeFilterCount={activeFilterCount}
      >
        <TicketFilters
          organizations={organizations}
          internalUsers={internalUsers}
          initialFilters={{
            status: params.status,
            priority: params.priority,
            orgId: params.orgId,
            assigneeId: params.assigneeId,
            search: params.search,
            tagIds: params.tagIds,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
            searchInComments: params.searchInComments,
          }}
        />
      </TicketToolbar>

      {/* Ticket list */}
      <TicketList
        tickets={ticketList as unknown as TicketWithRelations[]}
        internalUsers={internalUsers}
        searchTerm={params.search}
        currentUserId={user.user.id}
        hasFilters={activeFilterCount > 0}
      />
    </div>
  );
}
