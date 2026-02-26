'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Archive, ArchiveRestore, Trash2, Loader2, Edit } from 'lucide-react';
import Link from 'next/link';

interface AssetDetailActionsProps {
  assetId: string;
  assetName: string;
  isArchived: boolean;
  basePath: string;
  linkedTicketCount: number;
}

export function AssetDetailActions({
  assetId,
  assetName,
  isArchived,
  basePath,
  linkedTicketCount,
}: AssetDetailActionsProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showUnarchiveDialog, setShowUnarchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleArchive = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to archive asset');
      }

      success('Asset archived successfully');
      router.refresh();
    } catch (error) {
      error(err instanceof Error ? err.message : 'Failed to archive asset');
    } finally {
      setIsProcessing(false);
      setShowArchiveDialog(false);
    }
  };

  const handleUnarchive = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unarchive' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to unarchive asset');
      }

      success('Asset unarchived successfully');
      router.refresh();
    } catch (error) {
      error(err instanceof Error ? err.message : 'Failed to unarchive asset');
    } finally {
      setIsProcessing(false);
      setShowUnarchiveDialog(false);
    }
  };

  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.linkedTicketCount) {
          throw new Error(`Cannot delete: Asset has ${data.linkedTicketCount} linked ticket(s). Please unlink tickets first.`);
        }
        throw new Error(data.error || 'Failed to delete asset');
      }

      success('Asset deleted successfully');
      router.push(`${basePath}`);
      router.refresh();
    } catch (error) {
      error(err instanceof Error ? err.message : 'Failed to delete asset');
    } finally {
      setIsProcessing(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Link href={`${basePath}/${assetId}/edit`}>
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </Link>
        
        {!isArchived ? (
          <Button
            variant="outline"
            size="sm"
            className="text-orange-600 hover:text-orange-700"
            onClick={() => setShowArchiveDialog(true)}
          >
            <Archive className="h-4 w-4 mr-2" />
            Archive
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="text-green-600 hover:text-green-700"
            onClick={() => setShowUnarchiveDialog(true)}
          >
            <ArchiveRestore className="h-4 w-4 mr-2" />
            Unarchive
          </Button>
        )}
        
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 hover:text-red-700"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>

      {/* Archive Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Asset</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive &quot;{assetName}&quot;?
              <br /><br />
              Archived assets will be hidden from the default view but can be restored later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchiveDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleArchive} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Archiving...
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unarchive Dialog */}
      <Dialog open={showUnarchiveDialog} onOpenChange={setShowUnarchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unarchive Asset</DialogTitle>
            <DialogDescription>
              Restore &quot;{assetName}&quot; to the active assets list?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnarchiveDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleUnarchive} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <ArchiveRestore className="h-4 w-4 mr-2" />
                  Unarchive
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete &quot;{assetName}&quot;?
              <br /><br />
              <span className="text-red-600 font-medium">This action cannot be undone.</span>
              {linkedTicketCount > 0 && (
                <>
                  <br /><br />
                  <span className="text-amber-600">
                    Warning: This asset has {linkedTicketCount} linked ticket(s). 
                    You must unlink all tickets before deleting.
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={isProcessing || linkedTicketCount > 0}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Permanently
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
