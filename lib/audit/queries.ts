import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function getAuditLogsForTicket(ticketId: string) {
  const logs = await db.query.auditLogs.findMany({
    where: eq(auditLogs.ticketId, ticketId),
    orderBy: [desc(auditLogs.createdAt)],
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      organization: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });
  
  // Map to ensure proper types (handle Drizzle relation type inference)
  return logs.map(log => ({
    ...log,
    user: log.user ? {
      id: log.user.id,
      name: log.user.name,
      email: log.user.email,
    } : null,
    organization: log.organization ? {
      id: log.organization.id,
      name: log.organization.name,
    } : null,
  }));
}
