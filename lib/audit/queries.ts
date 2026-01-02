import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function getAuditLogsForTicket(ticketId: string) {
  return db.query.auditLogs.findMany({
    where: eq(auditLogs.ticketId, ticketId),
    orderBy: [desc(auditLogs.createdAt)],
    with: {
      user: true,
      organization: true,
    },
  });
}
