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
  area?: { id: string; name: string } | null;
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
import { SavedViews } from "@/components/tickets/saved-views";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Filter,
  MessageSquarePlus,
  ShieldCheck,
  TicketIcon,
} from "lucide-react";

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
    <div className="space-y-5">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-orange-600">
              <TicketIcon className="h-4 w-4" />
              Service Desk
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Ticket Queue
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Dense operations view for lifecycle, SLA, assignment, public
              intake, comments, attachments, linking, merge review, and audit
              context.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="h-9 px-3">
              <Filter className="mr-2 h-4 w-4" />
              {activeFilterCount} active filters
            </Badge>
            <Button asChild variant="outline">
              <Link href="/app/admin/audit">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Audit context
              </Link>
            </Button>
            <Button asChild>
              <Link href="/app/tickets/new">
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                New Ticket
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="text-base">Saved Views</CardTitle>
            </CardHeader>
            <CardContent>
              <SavedViews currentUserId={user.user.id} />
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="text-base">Filters</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </aside>

        <Card className="min-w-0 border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">All Tickets</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                {ticketList.length} matching records, including public intake
                when selected.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <TicketList
              tickets={ticketList as unknown as TicketWithRelations[]}
              internalUsers={internalUsers}
              searchTerm={params.search}
              currentUserId={user.user.id}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
