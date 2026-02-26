'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Eye, AlertTriangle, Filter, Shield, Users, Globe } from 'lucide-react';
import { getAIAuditLogsAction, getAIAuditLogDetailAction, type AIAuditFilters } from '@/app/app/actions/ai-audit';
import type { aiAuditLog } from '@/db/schema';

interface AuditLog extends typeof aiAuditLog.$inferSelect {
  org?: { name: string } | null;
  user?: { name: string | null; email: string } | null;
}

const interfaceIcons: Record<string, React.ReactNode> = {
  public: <Globe className="h-4 w-4" />,
  customer: <Users className="h-4 w-4" />,
  admin: <Shield className="h-4 w-4" />,
};

const interfaceColors: Record<string, string> = {
  public: 'bg-gray-100 text-gray-800',
  customer: 'bg-blue-100 text-blue-800',
  admin: 'bg-purple-100 text-purple-800',
};

export function AIAuditDashboard() {
  const { error } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [filters, setFilters] = useState<AIAuditFilters>({});

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await getAIAuditLogsAction(filters, 50);
      setLogs(data as AuditLog[]);
    } catch (err) {
      error('Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const viewDetail = async (logId: string) => {
    try {
      const log = await getAIAuditLogDetailAction(logId);
      setSelectedLog(log as AuditLog);
    } catch (err) {
      error('Failed to load log detail');
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <Select
            value={filters.interface || 'all'}
            onValueChange={(v) => setFilters({ ...filters, interface: v === 'all' ? undefined : v as any })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Interface" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Interfaces</SelectItem>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.piiDetected === true ? 'yes' : filters.piiDetected === false ? 'no' : 'all'}
            onValueChange={(v) => setFilters({ 
              ...filters, 
              piiDetected: v === 'all' ? undefined : v === 'yes' 
            })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="PII Detected" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="yes">PII Detected</SelectItem>
              <SelectItem value="no">No PII</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={loadLogs} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>

        {/* Audit Log Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Interface</TableHead>
                <TableHead>User/Org</TableHead>
                <TableHead>Query</TableHead>
                <TableHead>Security</TableHead>
                <TableHead>Response Time</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={interfaceColors[log.interface]}>
                        <span className="flex items-center gap-1">
                          {interfaceIcons[log.interface]}
                          {log.interface}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {log.user ? (
                          <span>{log.user.name || log.user.email}</span>
                        ) : (
                          <span className="text-gray-500">Anonymous</span>
                        )}
                        {log.org && (
                          <div className="text-xs text-gray-500">{log.org.name}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[300px] truncate" title={log.userQuery}>
                        {log.userQuery}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {log.piiDetected && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            PII
                          </Badge>
                        )}
                        {log.wasFiltered && (
                          <Badge variant="outline" className="text-red-600 border-red-300">
                            <Filter className="h-3 w-3 mr-1" />
                            Filtered
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.responseTimeMs ? `${log.responseTimeMs}ms` : '-'}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => viewDetail(log.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Audit Log Detail</DialogTitle>
                          </DialogHeader>
                          {selectedLog && (
                            <div className="space-y-4 pt-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">ID:</span> {selectedLog.id.slice(0, 8)}...
                                </div>
                                <div>
                                  <span className="text-gray-500">Time:</span> {new Date(selectedLog.createdAt).toLocaleString()}
                                </div>
                                <div>
                                  <span className="text-gray-500">Interface:</span>{' '}
                                  <Badge className={interfaceColors[selectedLog.interface]}>
                                    {selectedLog.interface}
                                  </Badge>
                                </div>
                                <div>
                                  <span className="text-gray-500">User:</span>{' '}
                                  {selectedLog.user?.name || selectedLog.user?.email || 'Anonymous'}
                                </div>
                                <div>
                                  <span className="text-gray-500">Organization:</span>{' '}
                                  {selectedLog.org?.name || 'N/A'}
                                </div>
                                <div>
                                  <span className="text-gray-500">IP Address:</span> {selectedLog.ipAddress || 'N/A'}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <h4 className="font-medium">User Query</h4>
                                <div className="bg-gray-50 p-3 rounded-lg text-sm whitespace-pre-wrap">
                                  {selectedLog.userQuery}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <h4 className="font-medium">AI Response</h4>
                                <div className="bg-gray-50 p-3 rounded-lg text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                                  {selectedLog.aiResponse}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <h4 className="font-medium">Security Info</h4>
                                <div className="text-sm space-y-1">
                                  <p><span className="text-gray-500">PII Detected:</span> {selectedLog.piiDetected ? 'Yes' : 'No'}</p>
                                  {selectedLog.piiTypes && selectedLog.piiTypes.length > 0 && (
                                    <p><span className="text-gray-500">PII Types:</span> {(selectedLog.piiTypes as string[]).join(', ')}</p>
                                  )}
                                  <p><span className="text-gray-500">Was Filtered:</span> {selectedLog.wasFiltered ? 'Yes' : 'No'}</p>
                                  <p><span className="text-gray-500">System Prompt Hash:</span> <code className="text-xs">{selectedLog.systemPromptHash.slice(0, 16)}...</code></p>
                                </div>
                              </div>

                              {selectedLog.sourcesUsed && (selectedLog.sourcesUsed as string[]).length > 0 && (
                                <div className="space-y-2">
                                  <h4 className="font-medium">Data Sources Used</h4>
                                  <div className="flex gap-2 flex-wrap">
                                    {(selectedLog.sourcesUsed as string[]).map((source) => (
                                      <Badge key={source} variant="outline">{source}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="text-xs text-gray-500 pt-4 border-t">
                                Model: {selectedLog.modelUsed || 'Unknown'} | 
                                Tokens: {selectedLog.tokensUsed || 'Unknown'} | 
                                Response Time: {selectedLog.responseTimeMs}ms
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
