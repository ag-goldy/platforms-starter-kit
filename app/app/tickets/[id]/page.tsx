import { requireInternalRole } from '@/lib/auth/permissions';
import { getTicketById } from '@/lib/tickets/queries';
import { getInternalUsers } from '@/lib/users/queries';
import { getAuditLogsForTicket } from '@/lib/audit/queries';
import { notFound } from 'next/navigation';
import { TicketDetail } from '@/components/tickets/ticket-detail';
import { AuditLogList } from '@/components/tickets/audit-log';

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireInternalRole();
  const { id } = await params;

  const [ticket, internalUsers, auditLogs] = await Promise.all([
    getTicketById(id),
    getInternalUsers(),
    getAuditLogsForTicket(id),
  ]);

  if (!ticket) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <TicketDetail ticket={ticket} internalUsers={internalUsers} />
      <AuditLogList logs={auditLogs} />
    </div>
  );
}
