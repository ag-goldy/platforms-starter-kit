'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface SLADashboardProps {
  report: {
    totalTickets: number;
    responseMetrics: {
      total: number;
      met: number;
      warning: number;
      breached: number;
      averageTime: number;
    };
    resolutionMetrics: {
      total: number;
      met: number;
      warning: number;
      breached: number;
      averageTime: number;
    };
    tickets: Array<{
      ticketId: string;
      ticketKey: string;
      priority: string;
      status: string;
      firstResponseTime?: number;
      resolutionTime?: number;
      responseSLAStatus?: string;
      resolutionSLAStatus?: string;
    }>;
  };
  organizations: { id: string; name: string }[];
}

export function SLADashboard(props: SLADashboardProps) {
  const { report } = props;

  const responseCompliance =
    report.responseMetrics.total > 0
      ? ((report.responseMetrics.met / report.responseMetrics.total) * 100).toFixed(1)
      : '0';

  const resolutionCompliance =
    report.resolutionMetrics.total > 0
      ? ((report.resolutionMetrics.met / report.resolutionMetrics.total) * 100).toFixed(1)
      : '0';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Response Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{responseCompliance}%</div>
            <p className="text-xs text-gray-500 mt-1">
              {report.responseMetrics.met} of {report.responseMetrics.total} tickets
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Resolution Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resolutionCompliance}%</div>
            <p className="text-xs text-gray-500 mt-1">
              {report.resolutionMetrics.met} of {report.resolutionMetrics.total} tickets
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {report.responseMetrics.averageTime.toFixed(1)}h
            </div>
            <p className="text-xs text-gray-500 mt-1">Average first response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {report.resolutionMetrics.averageTime.toFixed(1)}h
            </div>
            <p className="text-xs text-gray-500 mt-1">Average resolution</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Response SLA Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Met</span>
                </div>
                <span className="font-medium">{report.responseMetrics.met}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm">Warning</span>
                </div>
                <span className="font-medium">{report.responseMetrics.warning}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">Breached</span>
                </div>
                <span className="font-medium">{report.responseMetrics.breached}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resolution SLA Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Met</span>
                </div>
                <span className="font-medium">{report.resolutionMetrics.met}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm">Warning</span>
                </div>
                <span className="font-medium">{report.resolutionMetrics.warning}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">Breached</span>
                </div>
                <span className="font-medium">{report.resolutionMetrics.breached}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tickets with SLA Issues</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {report.tickets
              .filter(
                (t) =>
                  t.responseSLAStatus === 'breached' ||
                  t.responseSLAStatus === 'warning' ||
                  t.resolutionSLAStatus === 'breached' ||
                  t.resolutionSLAStatus === 'warning'
              )
              .slice(0, 20)
              .map((ticket) => (
                <div
                  key={ticket.ticketId}
                  className="flex items-center justify-between rounded-md border bg-white p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold">{ticket.ticketKey}</span>
                    <Badge className="text-xs">{ticket.priority}</Badge>
                    {(ticket.responseSLAStatus === 'breached' ||
                      ticket.responseSLAStatus === 'warning') && (
                      <Badge
                        className={
                          ticket.responseSLAStatus === 'breached'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }
                      >
                        Response: {ticket.responseSLAStatus}
                      </Badge>
                    )}
                    {(ticket.resolutionSLAStatus === 'breached' ||
                      ticket.resolutionSLAStatus === 'warning') && (
                      <Badge
                        className={
                          ticket.resolutionSLAStatus === 'breached'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }
                      >
                        Resolution: {ticket.resolutionSLAStatus}
                      </Badge>
                    )}
                  </div>
                  <a
                    href={`/app/tickets/${ticket.ticketId}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View
                  </a>
                </div>
              ))}
            {report.tickets.filter(
              (t) =>
                t.responseSLAStatus === 'breached' ||
                t.responseSLAStatus === 'warning' ||
                t.resolutionSLAStatus === 'breached' ||
                t.resolutionSLAStatus === 'warning'
            ).length === 0 && (
              <p className="text-sm text-gray-500 py-4 text-center">
                No tickets with SLA issues
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
