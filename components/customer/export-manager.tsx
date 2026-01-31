'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { requestOrgExportAction } from '@/app/s/[subdomain]/actions/exports';

interface ExportRequestItem {
  id: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
  filename: string | null;
  downloadUrl: string | null;
  isExpired: boolean;
  requestedBy?: { name: string | null; email: string } | null;
}

interface CustomerExportManagerProps {
  orgId: string;
  requests: ExportRequestItem[];
}

export function CustomerExportManager({ orgId, requests }: CustomerExportManagerProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequest = async () => {
    setIsRequesting(true);
    try {
      await requestOrgExportAction(orgId);
      showToast('Export request submitted', 'success');
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to request export', 'error');
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Export Your Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Generate a full JSON export of your organization data. Links expire after 24 hours.
          </p>
          <Button onClick={handleRequest} disabled={isRequesting}>
            {isRequesting ? 'Requesting...' : 'Request Export'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          {requests.length === 0 ? (
            <p className="text-sm text-gray-500">No exports requested yet.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div key={request.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {request.filename || 'Organization Export'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Requested {new Date(request.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={request.status === 'FAILED' ? 'destructive' : 'outline'}>
                      {request.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                    {request.completedAt && (
                      <span>Completed {new Date(request.completedAt).toLocaleString()}</span>
                    )}
                    {request.isExpired && <span>Expired</span>}
                  </div>
                  <div className="mt-3">
                    {request.downloadUrl && !request.isExpired ? (
                      <a
                        href={request.downloadUrl}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Download export
                      </a>
                    ) : (
                      <span className="text-sm text-gray-500">
                        {request.status === 'COMPLETED' ? 'Export expired' : 'Export not ready'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
