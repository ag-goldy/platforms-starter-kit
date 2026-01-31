import { AuditLog } from '@/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils/date';

interface AuditLogProps {
  logs: (AuditLog & { 
    user: { id: string; name: string | null; email: string } | null;
    organization: { id: string; name: string } | null;
  })[];
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
};

function formatDetails(details: string | null) {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    const entries = Object.entries(parsed);
    if (entries.length === 0) return details;
    return entries
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' • ');
  } catch {
    return details;
  }
}

export function AuditLogList({ logs }: AuditLogProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Log</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">No audit events yet.</p>
        ) : (
          logs.map((log) => {
            const label = actionLabels[log.action] || log.action;
            const detailText = formatDetails(log.details);
            return (
              <div key={log.id} className="space-y-1 rounded-md border bg-white p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{label}</span>
                  <span className="text-xs text-gray-500">
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  {log.user?.name || log.user?.email || 'System'}
                </p>
                {detailText && (
                  <p className="text-xs text-gray-500">{detailText}</p>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
