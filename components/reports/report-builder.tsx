'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ReportResults } from './report-results';
import { generateReportAction, exportReportCSVAction, exportReportJSONAction, getExportJobStatusAction } from '@/app/app/actions/reports';
import { useToast } from '@/components/ui/toast';
import { Download, FileJson } from 'lucide-react';
import type { ReportData, ReportFilters } from '@/lib/reports/queries';
import type { TicketPriority, TicketStatus } from '@/lib/tickets/queries';
import type { JobStatus } from '@/lib/jobs/types';

interface ReportBuilderProps {
  organizations: { id: string; name: string }[];
  internalUsers: { id: string; name: string | null; email: string }[];
}

export function ReportBuilder({ organizations, internalUsers }: ReportBuilderProps) {
  const { showToast } = useToast();
  const [filters, setFilters] = useState<ReportFilters>({
    sortBy: 'created',
    sortOrder: 'desc',
  });
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<JobStatus | 'NOT_FOUND' | null>(null);
  const [exportDownloadUrl, setExportDownloadUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const data = await generateReportAction(filters);
      setReportData(data);
      showToast(`Report generated: Found ${data.summary.total} tickets`, 'success');
    } catch {
      showToast('Failed to generate report', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Poll for export job status
  useEffect(() => {
    if (!exportJobId || exportStatus === 'COMPLETED' || exportStatus === 'FAILED') {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const status = await getExportJobStatusAction(exportJobId);
        setExportStatus(status.status);
        
        if (status.status === 'COMPLETED' && status.downloadUrl) {
          setExportDownloadUrl(status.downloadUrl);
          setIsExporting(false);
          showToast('Export ready for download', 'success');
          clearInterval(pollInterval);
        } else if (status.status === 'FAILED') {
          setIsExporting(false);
          showToast(status.error || 'Export failed', 'error');
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Failed to check export status:', error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [exportJobId, exportStatus, showToast]);

  const handleExportCSV = async () => {
    if (!reportData) return;

    setIsExporting(true);
    setExportStatus('PENDING');
    setExportDownloadUrl(null);
    try {
      const result = await exportReportCSVAction(filters);
      if (result.jobId) {
        setExportJobId(result.jobId);
        setExportStatus('PENDING');
        showToast('Export started. You will be notified when ready.', 'success');
      } else {
        throw new Error('Failed to start export job');
      }
    } catch {
      setIsExporting(false);
      setExportStatus(null);
      showToast('Failed to start CSV export', 'error');
    }
  };

  const handleExportJSON = async () => {
    if (!reportData) return;

    setIsExporting(true);
    setExportStatus('PENDING');
    setExportDownloadUrl(null);
    try {
      const result = await exportReportJSONAction(filters);
      if (result.jobId) {
        setExportJobId(result.jobId);
        setExportStatus('PENDING');
        showToast('Export started. You will be notified when ready.', 'success');
      } else {
        throw new Error('Failed to start export job');
      }
    } catch {
      setIsExporting(false);
      setExportStatus(null);
      showToast('Failed to start JSON export', 'error');
    }
  };

  const handleDownloadExport = () => {
    if (exportDownloadUrl) {
      window.open(exportDownloadUrl, '_blank');
      setExportJobId(null);
      setExportStatus(null);
      setExportDownloadUrl(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="orgId">Organization</Label>
              <Select
                value={filters.orgId || 'all'}
                onValueChange={(value) =>
                  setFilters({ ...filters, orgId: value === 'all' ? undefined : value })
                }
              >
                <SelectTrigger id="orgId">
                  <SelectValue placeholder="All organizations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All organizations</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigneeId">Assignee</Label>
              <Select
                value={filters.assigneeId === null ? 'unassigned' : filters.assigneeId || 'all'}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    assigneeId: value === 'all' ? undefined : value === 'unassigned' ? null : value,
                  })
                }
              >
                <SelectTrigger id="assigneeId">
                  <SelectValue placeholder="All assignees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assignees</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {internalUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={filters.status?.[0] || 'all'}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    status: value === 'all' ? undefined : [value as TicketStatus],
                  })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="WAITING_ON_CUSTOMER">Waiting on Customer</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={filters.priority?.[0] || 'all'}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    priority: value === 'all' ? undefined : [value as TicketPriority],
                  })
                }
              >
                <SelectTrigger id="priority">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="P1">P1 - Critical</SelectItem>
                  <SelectItem value="P2">P2 - High</SelectItem>
                  <SelectItem value="P3">P3 - Medium</SelectItem>
                  <SelectItem value="P4">P4 - Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFrom">Date From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={
                  filters.dateFrom
                    ? filters.dateFrom.toISOString().split('T')[0]
                    : ''
                }
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    dateFrom: e.target.value ? new Date(e.target.value) : undefined,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">Date To</Label>
              <Input
                id="dateTo"
                type="date"
                value={
                  filters.dateTo
                    ? filters.dateTo.toISOString().split('T')[0]
                    : ''
                }
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    dateTo: e.target.value ? new Date(e.target.value) : undefined,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search in subject, description, key..."
                value={filters.search || ''}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value || undefined })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sortBy">Sort By</Label>
              <Select
                value={filters.sortBy || 'created'}
                onValueChange={(value) =>
                  setFilters({ ...filters, sortBy: value as ReportFilters['sortBy'] })
                }
              >
                <SelectTrigger id="sortBy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created">Created Date</SelectItem>
                  <SelectItem value="updated">Updated Date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Select
                value={filters.sortOrder || 'desc'}
                onValueChange={(value) =>
                  setFilters({ ...filters, sortOrder: value as ReportFilters['sortOrder'] })
                }
              >
                <SelectTrigger id="sortOrder">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descending</SelectItem>
                  <SelectItem value="asc">Ascending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="searchInComments"
              checked={filters.searchInComments || false}
              onCheckedChange={(checked) =>
                setFilters({ ...filters, searchInComments: checked as boolean })
              }
            />
            <Label htmlFor="searchInComments" className="cursor-pointer">
              Search in comments
            </Label>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate Report'}
            </Button>
            {reportData && (
              <>
                {exportDownloadUrl ? (
                  <Button
                    variant="outline"
                    onClick={handleDownloadExport}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Export
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleExportCSV}
                      disabled={isExporting}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {isExporting && exportStatus === 'PENDING' ? 'Exporting CSV...' : 'Export CSV'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleExportJSON}
                      disabled={isExporting}
                    >
                      <FileJson className="mr-2 h-4 w-4" />
                      {isExporting && exportStatus === 'PENDING' ? 'Exporting JSON...' : 'Export JSON'}
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {reportData && <ReportResults data={reportData} />}
    </div>
  );
}
