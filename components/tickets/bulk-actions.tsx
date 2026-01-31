'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  bulkUpdateStatusAction,
  bulkUpdatePriorityAction,
  bulkAssignAction,
  bulkAddTagAction,
  bulkCloseAction,
} from '@/app/app/actions/bulk';
import { getAllTagsAction } from '@/app/app/actions/tags';
import { useRouter } from 'next/navigation';
import type { TicketTag } from '@/db/schema';

interface BulkActionsProps {
  selectedTicketIds: string[];
  onClearSelection: () => void;
  internalUsers: { id: string; name: string | null; email: string }[];
}

export function BulkActions({
  selectedTicketIds,
  onClearSelection,
  internalUsers,
}: BulkActionsProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [priority, setPriority] = useState<string>('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [tagId, setTagId] = useState<string>('');
  const [tags, setTags] = useState<TicketTag[]>([]);

  useEffect(() => {
    async function loadTags() {
      try {
        const allTags = await getAllTagsAction();
        setTags(allTags);
      } catch (error) {
        console.error('Failed to load tags:', error);
      }
    }
    loadTags();
  }, []);

  const handleBulkStatus = async () => {
    if (!status) return;
    setIsProcessing(true);
    setError(null);
    try {
      await bulkUpdateStatusAction(selectedTicketIds, status);
      onClearSelection();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkPriority = async () => {
    if (!priority) return;
    setIsProcessing(true);
    setError(null);
    try {
      await bulkUpdatePriorityAction(selectedTicketIds, priority);
      onClearSelection();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update priority');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkAssign = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const assignee = assigneeId === 'unassigned' ? null : assigneeId;
      await bulkAssignAction(selectedTicketIds, assignee);
      onClearSelection();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign tickets');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkAddTag = async () => {
    if (!tagId) return;
    setIsProcessing(true);
    setError(null);
    try {
      await bulkAddTagAction(selectedTicketIds, tagId);
      onClearSelection();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add tag');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkClose = async () => {
    if (!confirm(`Are you sure you want to close ${selectedTicketIds.length} ticket(s)?`)) {
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      await bulkCloseAction(selectedTicketIds);
      onClearSelection();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close tickets');
    } finally {
      setIsProcessing(false);
    }
  };

  if (selectedTicketIds.length === 0) {
    return null;
  }

  return (
    <div className="sticky top-0 z-10 rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {selectedTicketIds.length} ticket{selectedTicketIds.length !== 1 ? 's' : ''} selected
          </span>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Clear
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="space-y-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Set status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NEW">New</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="WAITING_ON_CUSTOMER">Waiting on Customer</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleBulkStatus}
            disabled={!status || isProcessing}
            size="sm"
            className="w-full"
          >
            Update Status
          </Button>
        </div>

        <div className="space-y-2">
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue placeholder="Set priority..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="P1">P1 - Critical</SelectItem>
              <SelectItem value="P2">P2 - High</SelectItem>
              <SelectItem value="P3">P3 - Medium</SelectItem>
              <SelectItem value="P4">P4 - Low</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleBulkPriority}
            disabled={!priority || isProcessing}
            size="sm"
            className="w-full"
          >
            Update Priority
          </Button>
        </div>

        <div className="space-y-2">
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger>
              <SelectValue placeholder="Assign to..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {internalUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name || user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleBulkAssign}
            disabled={isProcessing}
            size="sm"
            className="w-full"
          >
            Assign
          </Button>
        </div>

        <div className="space-y-2">
          <Select value={tagId} onValueChange={setTagId}>
            <SelectTrigger>
              <SelectValue placeholder="Add tag..." />
            </SelectTrigger>
            <SelectContent>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleBulkAddTag}
            disabled={!tagId || isProcessing}
            size="sm"
            className="w-full"
          >
            Add Tag
          </Button>
        </div>

        <div className="space-y-2">
          <Button
            onClick={handleBulkClose}
            disabled={isProcessing}
            size="sm"
            variant="destructive"
            className="w-full"
          >
            Close All
          </Button>
        </div>
      </div>
    </div>
  );
}

