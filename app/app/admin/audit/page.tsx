import { requireInternalAdmin } from '@/lib/auth/permissions';
import { db } from '@/db';
import { auditLogs, users, auditActionEnum } from '@/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils/date';

interface SearchParams {
  orgId?: string;
  userId?: string;
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

export default async function AuditAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireInternalAdmin();
  const params = await searchParams;

  const whereClauses = [];

  if (params.orgId) {
    whereClauses.push(eq(auditLogs.orgId, params.orgId));
  }

  if (params.userId) {
    whereClauses.push(eq(auditLogs.userId, params.userId));
  }

  if (params.action) {
    whereClauses.push(eq(auditLogs.action, params.action as (typeof auditActionEnum.enumValues)[number]));
  }

  if (params.dateFrom) {
    whereClauses.push(gte(auditLogs.createdAt, new Date(params.dateFrom)));
  }

  if (params.dateTo) {
    whereClauses.push(lte(auditLogs.createdAt, new Date(params.dateTo)));
  }

  const logs = await db.query.auditLogs.findMany({
    where: whereClauses.length > 0 ? and(...whereClauses) : undefined,
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
      organization: {
        columns: {
          id: true,
          name: true,
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

  const orgs = await db.query.organizations.findMany({
    columns: {
      id: true,
      name: true,
    },
    orderBy: (table, { asc }) => [asc(table.name)],
  });

  const internalUsers = await db.query.users.findMany({
    where: eq(users.isInternal, true),
    columns: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: (table, { asc }) => [asc(table.email)],
  });

  const actions = auditActionEnum.enumValues;

  const search = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-sm text-gray-600">
          View audited actions across all organizations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Organization</label>
              <select
                name="orgId"
                defaultValue={search.orgId ?? ''}
                className="w-full rounded-md border px-2 py-1 text-sm"
              >
                <option value="">All</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">User</label>
              <select
                name="userId"
                defaultValue={search.userId ?? ''}
                className="w-full rounded-md border px-2 py-1 text-sm"
              >
                <option value="">All</option>
                {internalUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Action</label>
              <select
                name="action"
                defaultValue={search.action ?? ''}
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
            <div className="space-y-1 md:col-span-1">
              <label className="text-xs font-medium text-gray-600">From</label>
              <input
                type="date"
                name="dateFrom"
                defaultValue={search.dateFrom ?? ''}
                className="w-full rounded-md border px-2 py-1 text-sm"
              />
              <label className="mt-2 block text-xs font-medium text-gray-600">To</label>
              <input
                type="date"
                name="dateTo"
                defaultValue={search.dateTo ?? ''}
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
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-gray-500">No audit events found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-500">
                    <th className="px-2 py-1">Time</th>
                    <th className="px-2 py-1">Organization</th>
                    <th className="px-2 py-1">User</th>
                    <th className="px-2 py-1">Action</th>
                    <th className="px-2 py-1">Ticket</th>
                    <th className="px-2 py-1">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="px-2 py-1 whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-2 py-1">
                        {log.organization?.name || '—'}
                      </td>
                      <td className="px-2 py-1">
                        {log.user?.name || log.user?.email || 'System'}
                      </td>
                      <td className="px-2 py-1">
                        {actionLabels[log.action] || log.action}
                      </td>
                      <td className="px-2 py-1">
                        {log.ticket?.key || '—'}
                      </td>
                      <td className="max-w-xs px-2 py-1 text-xs text-gray-600">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
