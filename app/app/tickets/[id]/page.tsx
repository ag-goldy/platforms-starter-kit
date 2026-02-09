import { requireInternalRole } from '@/lib/auth/permissions';
import { getTicketById } from '@/lib/tickets/queries';
import { getInternalUsers } from '@/lib/users/queries';
import { getAuditLogsForTicket } from '@/lib/audit/queries';
import { getTicketSLAMetrics } from '@/lib/tickets/sla';
import { notFound } from 'next/navigation';
import { TicketDetail } from '@/components/tickets/ticket-detail';
import { AuditLogList } from '@/components/tickets/audit-log';
import { type Ticket, type TicketComment, type Attachment } from '@/db/schema';
import { db } from '@/db';
import { assets } from '@/db/schema';
import { eq } from 'drizzle-orm';

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
  if (!ticket || !('organization' in ticket) || !('requester' in ticket) || !('assignee' in ticket) || !('comments' in ticket) || !('attachments' in ticket)) {
    notFound();
  }

  const availableAssets = await db.query.assets.findMany({
    where: eq(assets.orgId, ticket.orgId),
    orderBy: (table, { asc }) => [asc(table.name)],
    with: {
      site: true,
      area: true,
    },
  });

  return (
    <div className="space-y-6">
      <TicketDetail ticket={ticket as unknown as Ticket & {
        organization: { name: string };
        requester: { name: string | null; email: string } | null;
        assignee: { name: string | null; email: string } | null;
        comments: (TicketComment & {
          user: { name: string | null; email: string } | null;
        })[];
        attachments: Attachment[];
      }} internalUsers={internalUsers} slaMetrics={slaMetrics} availableAssets={availableAssets as any} />
      <AuditLogList logs={auditLogs} />
    </div>
  );
}
