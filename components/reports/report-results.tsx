'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils/date';
import type { ReportData } from '@/lib/reports/queries';

interface ReportResultsProps {
  data: ReportData;
}

export function ReportResults({ data }: ReportResultsProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-gray-600">Total Tickets</p>
              <p className="text-2xl font-bold">{data.summary.total}</p>
            </div>
            {data.summary.dateRange.from && (
              <div>
                <p className="text-sm text-gray-600">Date Range</p>
                <p className="text-sm">
                  {data.summary.dateRange.from.toLocaleDateString()} -{' '}
                  {data.summary.dateRange.to?.toLocaleDateString() || 'Present'}
                </p>
              </div>
            )}
          </div>

          {data.summary.byStatus.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">By Status</p>
              <div className="flex flex-wrap gap-2">
                {data.summary.byStatus.map((item) => (
                  <Badge key={item.status} variant="outline">
                    {item.status}: {item.count}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {data.summary.byPriority.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">By Priority</p>
              <div className="flex flex-wrap gap-2">
                {data.summary.byPriority.map((item) => (
                  <Badge key={item.priority} variant="outline">
                    {item.priority}: {item.count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tickets ({data.tickets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Key</th>
                  <th className="text-left p-2">Subject</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Priority</th>
                  <th className="text-left p-2">Organization</th>
                  <th className="text-left p-2">Assignee</th>
                  <th className="text-left p-2">Created</th>
                  <th className="text-left p-2">Comments</th>
                </tr>
              </thead>
              <tbody>
                {data.tickets.map((ticket) => (
                  <tr key={ticket.key} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs">{ticket.key}</td>
                    <td className="p-2">{ticket.subject}</td>
                    <td className="p-2">
                      <Badge variant="outline">{ticket.status}</Badge>
                    </td>
                    <td className="p-2">
                      <Badge variant="outline">{ticket.priority}</Badge>
                    </td>
                    <td className="p-2">{ticket.organization}</td>
                    <td className="p-2">{ticket.assignee || 'Unassigned'}</td>
                    <td className="p-2 text-xs text-gray-600">
                      {formatDateTime(ticket.createdAt)}
                    </td>
                    <td className="p-2">{ticket.commentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden space-y-4">
            {data.tickets.map((ticket) => (
              <div key={ticket.key} className="border rounded-lg p-4 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold">{ticket.key}</span>
                  <div className="flex gap-2">
                    <Badge variant="outline">{ticket.status}</Badge>
                    <Badge variant="outline">{ticket.priority}</Badge>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-sm">{ticket.subject}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Organization:</span>
                    <p>{ticket.organization}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Assignee:</span>
                    <p>{ticket.assignee || 'Unassigned'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Created:</span>
                    <p className="text-xs">{formatDateTime(ticket.createdAt)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Comments:</span>
                    <p>{ticket.commentCount}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

