'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Notice, Site } from '@/db/schema';
import { NoticeDialog } from '@/components/notices/notice-dialog';
import { toggleNoticeActiveAction } from '@/app/app/actions/notices';
import { useRouter } from 'next/navigation';
import { formatDateTime } from '@/lib/utils/date';

interface NoticeWithSite extends Notice {
  site?: Site | null;
}

interface NoticesManagerProps {
  orgId: string;
  notices: NoticeWithSite[];
  sites: Site[];
}

export function NoticesManager({ orgId, notices, sites }: NoticesManagerProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggle = async (notice: Notice) => {
    setTogglingId(notice.id);
    try {
      await toggleNoticeActiveAction(orgId, notice.id, !notice.isActive);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update notice');
    } finally {
      setTogglingId(null);
    }
  };

  if (notices.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-gray-500">No notices yet. Create the first banner.</p>
          <Button className="mt-4" onClick={() => setIsCreating(true)}>
            Create Notice
          </Button>
          {isCreating && (
            <NoticeDialog orgId={orgId} sites={sites} onClose={() => setIsCreating(false)} />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Notices</h2>
          <p className="text-sm text-gray-600">Active banners show in the customer portal.</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>Create Notice</Button>
      </div>

      <div className="space-y-4">
        {notices.map((notice) => (
          <Card key={notice.id} className={!notice.isActive ? 'opacity-70' : undefined}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {notice.title}
                {!notice.isActive && <Badge variant="secondary">Inactive</Badge>}
              </CardTitle>
              <p className="text-xs text-gray-500">{notice.type.replace('_', ' ')}</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{notice.severity}</Badge>
                {notice.site && <Badge variant="secondary">{notice.site.name}</Badge>}
              </div>
              <p className="whitespace-pre-wrap text-gray-700 line-clamp-3">{notice.body}</p>
              <div className="text-xs text-gray-500">
                {notice.startsAt && <span>Starts {formatDateTime(notice.startsAt)} </span>}
                {notice.endsAt && <span>Ends {formatDateTime(notice.endsAt)}</span>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingId(notice.id)}>
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggle(notice)}
                  disabled={togglingId === notice.id}
                >
                  {togglingId === notice.id
                    ? 'Updating...'
                    : notice.isActive
                    ? 'Disable'
                    : 'Enable'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isCreating && (
        <NoticeDialog orgId={orgId} sites={sites} onClose={() => setIsCreating(false)} />
      )}
      {editingId && (
        <NoticeDialog
          orgId={orgId}
          sites={sites}
          initialData={notices.find((notice) => notice.id === editingId) || null}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
