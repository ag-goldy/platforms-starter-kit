'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { RequestType } from '@/db/schema';
import { RequestTypeDialog } from '@/components/request-types/request-type-dialog';
import { toggleRequestTypeActiveAction } from '@/app/app/actions/request-types';
import { useRouter } from 'next/navigation';

interface RequestTypesManagerProps {
  orgId: string;
  requestTypes: RequestType[];
}

export function RequestTypesManager({ orgId, requestTypes }: RequestTypesManagerProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggle = async (requestType: RequestType) => {
    setTogglingId(requestType.id);
    try {
      await toggleRequestTypeActiveAction(orgId, requestType.id, !requestType.isActive);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update request type');
    } finally {
      setTogglingId(null);
    }
  };

  if (requestTypes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-gray-500">No request types yet. Create your first catalog item.</p>
          <Button className="mt-4" onClick={() => setIsCreating(true)}>
            Create Request Type
          </Button>
          {isCreating && (
            <RequestTypeDialog orgId={orgId} onClose={() => setIsCreating(false)} />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Service Catalog</h2>
          <p className="text-sm text-gray-600">Manage request types for this organization.</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>Create Request Type</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {requestTypes.map((requestType) => (
          <Card key={requestType.id} className={!requestType.isActive ? 'opacity-70' : undefined}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{requestType.name}</CardTitle>
              <p className="text-xs text-gray-500">{requestType.slug}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {requestType.description && (
                <p className="text-sm text-gray-600 line-clamp-2">{requestType.description}</p>
              )}
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{requestType.category.replace('_', ' ')}</Badge>
                <Badge variant="outline">{requestType.defaultPriority}</Badge>
                {requestType.requiredAttachments && <Badge variant="secondary">Attachments Required</Badge>}
                {!requestType.isActive && <Badge variant="secondary">Inactive</Badge>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingId(requestType.id)}>
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggle(requestType)}
                  disabled={togglingId === requestType.id}
                >
                  {togglingId === requestType.id
                    ? 'Updating...'
                    : requestType.isActive
                    ? 'Disable'
                    : 'Enable'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isCreating && (
        <RequestTypeDialog orgId={orgId} onClose={() => setIsCreating(false)} />
      )}
      {editingId && (
        <RequestTypeDialog
          orgId={orgId}
          initialData={requestTypes.find((type) => type.id === editingId) || null}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
