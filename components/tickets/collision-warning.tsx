'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface CollisionWarningProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  newComments: number;
  editorName?: string;
}

export function CollisionWarning({
  isOpen,
  onClose,
  onConfirm,
  newComments,
  editorName,
}: CollisionWarningProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Simultaneous Edit Detected
          </DialogTitle>
          <DialogDescription>
            Changes may have occurred while you were writing your reply.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {newComments > 0 && (
            <p className="text-sm text-muted-foreground">
              <strong>{newComments} new comment{newComments > 1 ? 's' : ''}</strong> {' '}
              {newComments > 1 ? 'have' : 'has'} been added to this ticket since you started typing.
            </p>
          )}
          
          {editorName && (
            <p className="text-sm text-muted-foreground mt-2">
              <strong>{editorName}</strong> is also currently editing this ticket.
            </p>
          )}

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <p className="font-medium">Warning:</p>
            <p className="mt-1">
              Your reply might overlap with recent changes. Consider reviewing the 
              new comments before submitting.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Review Changes
          </Button>
          <Button onClick={onConfirm} variant="default">
            Submit Anyway
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
