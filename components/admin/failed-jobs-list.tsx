'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { retryFailedJobAction, deleteFailedJobAction } from '@/app/app/actions/jobs';
import { useRouter } from 'next/navigation';
import { Trash2, RotateCw, AlertCircle } from 'lucide-react';
import type { JobType } from '@/lib/jobs/types';

interface FailedJob {
  id: string;
  jobId: string;
  type: string;
  data: unknown;
  error: string;
  attempts: number;
  maxAttempts: number;
  failedAt: Date;
  retriedAt: Date | null;
  createdAt: Date;
}

interface FailedJobsListProps {
  jobs: FailedJob[];
  total: number;
  currentPage: number;
  limit: number;
  filters: {
    type?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export function FailedJobsList({
  jobs,
  total,
  currentPage,
  limit,
  filters: initialFilters,
}: FailedJobsListProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  
  const totalPages = Math.ceil(total / limit);
  
  const handleRetry = async (failedJobId: string) => {
    setIsProcessing(failedJobId);
    try {
      const result = await retryFailedJobAction(failedJobId);
      if (result.success) {
        router.refresh();
      } else {
        alert(`Failed to retry job: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(null);
    }
  };
  
  const handleDelete = async (failedJobId: string) => {
    if (!confirm('Are you sure you want to delete this failed job? This cannot be undone.')) {
      return;
    }
    
    setIsProcessing(failedJobId);
    try {
      const result = await deleteFailedJobAction(failedJobId);
      if (result.success) {
        router.refresh();
      } else {
        alert(`Failed to delete job: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(null);
    }
  };
  
  const applyFilters = () => {
    const params = new URLSearchParams();
    if (filters.type) params.set('type', filters.type);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    params.set('page', '1');
    router.push(`/app/admin/jobs?${params.toString()}`);
  };
  
  const jobTypes: JobType[] = [
    'SEND_EMAIL',
    'GENERATE_EXPORT',
    'GENERATE_ORG_EXPORT',
    'RECALCULATE_SLA',
    'PROCESS_ATTACHMENT',
    'AUDIT_COMPACTION',
  ];
  
  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="type">Job Type</Label>
              <Select
                value={filters.type || 'all'}
                onValueChange={(value) => setFilters({ ...filters, type: value === 'all' ? undefined : value })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {jobTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="dateFrom">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
              />
            </div>
            
            <div>
              <Label htmlFor="dateTo">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })}
              />
            </div>
            
            <div className="flex items-end">
              <Button onClick={applyFilters} className="w-full">
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Jobs List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Failed Jobs ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No failed jobs found
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">{job.type}</Badge>
                        <span className="text-sm text-gray-500">
                          Job ID: {job.jobId}
                        </span>
                        {job.retriedAt && (
                          <Badge variant="outline">Retried</Badge>
                        )}
                      </div>
                      <div className="mt-2 text-sm">
                        <div className="flex items-center gap-2 text-red-600">
                          <AlertCircle className="h-4 w-4" />
                          <span className="font-medium">Error:</span>
                        </div>
                        <pre className="mt-1 p-2 bg-red-50 rounded text-xs overflow-x-auto">
                          {job.error}
                        </pre>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Attempts: {job.attempts}/{job.maxAttempts} • Failed: {new Date(job.failedAt).toLocaleString()}
                      </div>
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer">
                          View job data
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                          {JSON.stringify(job.data, null, 2)}
                        </pre>
                      </details>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetry(job.id)}
                        disabled={isProcessing === job.id}
                      >
                        <RotateCw className="h-4 w-4 mr-1" />
                        {isProcessing === job.id ? 'Retrying...' : 'Retry'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(job.id)}
                        disabled={isProcessing === job.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set('page', String(currentPage - 1));
                    router.push(`/app/admin/jobs?${params.toString()}`);
                  }}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set('page', String(currentPage + 1));
                    router.push(`/app/admin/jobs?${params.toString()}`);
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
