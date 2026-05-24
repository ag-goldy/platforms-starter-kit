import { requireInternalRole } from "@/lib/auth/permissions";
import { getTicketById } from "@/lib/tickets/queries";
import { getInternalUsers } from "@/lib/users/queries";
import { getAuditLogsForTicket } from "@/lib/audit/queries";
import { getTicketSLAMetrics } from "@/lib/tickets/sla";
import { notFound } from "next/navigation";
import { TicketDetail } from "@/components/tickets/ticket-detail";
import { AuditLogList } from "@/components/tickets/audit-log";
import { type Ticket, type TicketComment, type Attachment } from "@/db/schema";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, Clock3, GitMerge, History, ShieldCheck, TicketIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireInternalRole();
  const { id } = await params;

  const [ticket, internalUsers, auditLogs, slaMetrics] = await Promise.all([
    getTicketById(id),
    getInternalUsers(),
    getAuditLogsForTicket(id),
    getTicketSLAMetrics(id).catch(() => null),
  ]);

  if (!ticket) {
    notFound();
  }

  // Type guard to ensure ticket has required relations
  if (
    !ticket ||
    !("organization" in ticket) ||
    !("requester" in ticket) ||
    !("assignee" in ticket) ||
    !("comments" in ticket) ||
    !("attachments" in ticket)
  ) {
    notFound();
  }

  // Only load assets if ticket has an org (public tickets have no assets)
  const availableAssets = ticket.orgId
    ? await db.query.assets.findMany({
        where: eq(assets.orgId, ticket.orgId),
        orderBy: (table, { asc }) => [asc(table.name)],
        with: {
          site: true,
          area: true,
        },
      })
    : [];

  const typedTicket = ticket as unknown as Ticket & {
    organization: { name: string } | null;
    requesterEmail?: string | null;
    requester: { name: string | null; email: string } | null;
    assignee: { name: string | null; email: string } | null;
    comments: (TicketComment & {
      authorEmail?: string | null;
      user: { name: string | null; email: string } | null;
    })[];
    attachments: Attachment[];
  };

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <Link
              href="/app/tickets"
              className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to queue
            </Link>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">{typedTicket.key}</Badge>
              <Badge variant="outline">{typedTicket.status.replaceAll("_", " ")}</Badge>
              <Badge variant="outline">{typedTicket.priority}</Badge>
              {typedTicket.mergedIntoId && (
                <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                  <GitMerge className="mr-1 h-3.5 w-3.5" />
                  Merged source
                </Badge>
              )}
            </div>
            <h1 className="truncate text-2xl font-semibold tracking-tight">{typedTicket.subject}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {typedTicket.organization?.name || "Public intake"} · {typedTicket.requester?.name || typedTicket.requester?.email || typedTicket.requesterEmail || "Unknown requester"}
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3 xl:min-w-[520px]">
            <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-500"><TicketIcon className="h-3.5 w-3.5" /> Owner</div>
              <div className="mt-1 truncate font-medium">{typedTicket.assignee?.name || typedTicket.assignee?.email || "Unassigned"}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" /> Updated</div>
              <div className="mt-1 truncate font-medium">{typedTicket.updatedAt.toLocaleString()}</div>
            </div>
            <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5" /> Audit</div>
              <div className="mt-1 truncate font-medium">{auditLogs.length} events</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <TicketDetail
          ticket={typedTicket}
          internalUsers={internalUsers}
          slaMetrics={slaMetrics}
          availableAssets={availableAssets}
        />
        <aside className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4 text-slate-400" />
              Audit trail
            </div>
            <AuditLogList logs={auditLogs} />
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/app/admin/audit?resource=ticket&resourceId=${typedTicket.id}`}>
              Open full audit search
            </Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
