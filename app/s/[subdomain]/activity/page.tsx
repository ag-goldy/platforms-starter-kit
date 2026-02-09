import { notFound } from 'next/navigation';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { auditLogs, auditActionEnum } from '@/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils/date';

interface SearchParams {
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

const actionLabels: Record<string, string> = {
  TICKET_CREATED: 'Ticket created',
  TICKET_UPDATED: 'Ticket updated',
  TICKET_STATUS_CHANGED: 'Status changed',
  TICKET_ASSIGNED: 'Assignee updated',
  TICKET_PRIORITY_CHANGED: 'Priority changed',
  TICKET_COMMENT_ADDED: 'Comment added',
  USER_INVITED: 'User invited',
  USER_ROLE_CHANGED: 'User role changed',
  ORG_CREATED: 'Organization created',
  ORG_UPDATED: 'Organization updated',
  TICKET_MERGED: 'Ticket merged',
  TICKET_TAG_ADDED: 'Tag added to ticket',
  TICKET_TAG_REMOVED: 'Tag removed from ticket',
  EXPORT_REQUESTED: 'Export requested',
  MEMBERSHIP_DEACTIVATED: 'Membership deactivated',
};

export default async function CustomerActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { subdomain } = await params;
  const org = await getOrgBySubdomain(subdomain);

  if (!org) {
    notFound();
  }

  const filters = await searchParams;

  const { membership } = await requireOrgMemberRole(org.id, ['CUSTOMER_ADMIN']);

  const whereClauses = [eq(auditLogs.orgId, org.id)];

  if (filters.action) {
    whereClauses.push(eq(auditLogs.action, filters.action as (typeof auditActionEnum.enumValues)[number]));
  }

  if (filters.dateFrom) {
    whereClauses.push(gte(auditLogs.createdAt, new Date(filters.dateFrom)));
  }

  if (filters.dateTo) {
    whereClauses.push(lte(auditLogs.createdAt, new Date(filters.dateTo)));
  }

  const logs = await db.query.auditLogs.findMany({
    where: and(...whereClauses),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
    limit: 200,
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      ticket: {
        columns: {
          id: true,
          key: true,
        },
      },
    },
  });

  const actions = auditActionEnum.enumValues;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="text-sm text-gray-600">
          Recent activity and changes for your organization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Action</label>
              <select
                name="action"
                defaultValue={filters.action ?? ''}
                className="w-full rounded-md border px-2 py-1 text-sm"
              >
                <option value="">All</option>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">From</label>
              <input
                type="date"
                name="dateFrom"
                defaultValue={filters.dateFrom ?? ''}
                className="w-full rounded-md border px-2 py-1 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">To</label>
              <input
                type="date"
                name="dateTo"
                defaultValue={filters.dateTo ?? ''}
                className="w-full rounded-md border px-2 py-1 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Apply
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {logs.length === 0 ? (
            <p className="text-sm text-gray-500">No recent activity.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="space-y-1 rounded-md border bg-white p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {actionLabels[log.action] || log.action}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  {(log.user as { name?: string; email?: string } | undefined)?.name || 
                   (log.user as { name?: string; email?: string } | undefined)?.email || 'System'}
                  {membership.userId === log.userId ? ' (You)' : ''}
                </p>
                {(log.ticket as { key?: string } | undefined)?.key && (
                  <p className="text-xs text-gray-600">Ticket: {(log.ticket as { key?: string } | undefined)?.key}</p>
                )}
                {log.details && (
                  <p className="text-xs text-gray-500">{log.details}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
