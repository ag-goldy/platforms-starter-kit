'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { getAuditLogs, exportAuditLogs, formatAuditAction, type AuditLogFilters } from '@/app/app/actions/audit-logs';
import type { auditLogs } from '@/db/schema';

type Log = typeof auditLogs.$inferSelect & {
  user?: { id: string; name: string | null; email: string } | null;
};

interface AuditLogViewerProps {
  orgs: { id: string; name: string }[];
  actions: string[];
}

export function AuditLogViewer({ orgs, actions }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({});

  const loadLogs = useCallback(async (pageNum: number = 1) => {
    setLoading(true);
    try {
      const result = await getAuditLogs(filters, pageNum, 50);
      setLogs(result.logs);
      setTotalPages(result.pagination.totalPages);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const data = await exportAuditLogs(filters, format);
      const blob = new Blob([data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select
                value={filters.orgId}
                onValueChange={(v) => setFilters({ ...filters, orgId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All organizations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {orgs.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={filters.action}
                onValueChange={(v) => setFilters({ ...filters, action: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {actions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {formatAuditAction(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Search</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search details..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={() => loadLogs(1)} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('json')}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium">Timestamp</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Action</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Ticket</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">User</th>
                  <th className="px-4 py-2 text-left text-xs font-medium w-[100px]">View</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-muted/50">
                    <td className="px-4 py-2 text-sm whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline">{formatAuditAction(log.action)}</Badge>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {log.ticketId ? (
                        <span className="font-mono text-xs">{log.ticketId.slice(0, 8)}...</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {log.user?.name || log.user?.email || 'System'}
                    </td>
                    <td className="px-4 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No logs found. Use filters and click Search to load data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => loadLogs(page - 1)}
            disabled={page <= 1 || loading}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => loadLogs(page + 1)}
            disabled={page >= totalPages || loading}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Timestamp</Label>
                  <p>{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Action</Label>
                  <p>{formatAuditAction(selectedLog.action)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Ticket ID</Label>
                  <p className="font-mono text-sm">{selectedLog.ticketId || '-'}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Organization ID</Label>
                  <p className="font-mono text-sm">{selectedLog.orgId || '-'}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm text-gray-500">User</Label>
                <p>{selectedLog.user?.name || selectedLog.user?.email || 'System'}</p>
              </div>

              {selectedLog.details && (
                <div>
                  <Label className="text-sm text-gray-500">Details</Label>
                  <p className="text-sm bg-gray-50 p-2 rounded">
                    {selectedLog.details}
                  </p>
                </div>
              )}

              {selectedLog.ipAddress && (
                <div>
                  <Label className="text-sm text-gray-500">IP Address</Label>
                  <p className="font-mono text-sm">{selectedLog.ipAddress}</p>
                </div>
              )}

              {selectedLog.userAgent && (
                <div>
                  <Label className="text-sm text-gray-500">User Agent</Label>
                  <p className="text-xs text-gray-600">{selectedLog.userAgent}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
