'use client';

import { useState } from 'react';
import { AlertTriangle, Power, PowerOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { disableOrganizationAction, enableOrganizationAction, deleteOrganizationAction } from '@/app/app/actions/organizations';

interface OrgDangerZoneProps {
  orgId: string;
  orgName: string;
  isActive: boolean;
  disabledAt: Date | null;
  disabledBy: string | null;
}

export function OrgDangerZone({
  orgId,
  orgName,
  isActive,
  disabledAt,
  disabledBy,
}: OrgDangerZoneProps) {
  const { success, error } = useToast();
  const [isDisableDialogOpen, setIsDisableDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmationName, setConfirmationName] = useState('');

  const handleDisable = async () => {
    setIsDisabling(true);
    try {
      await disableOrganizationAction(orgId);
      success('Organization disabled successfully');
      setIsDisableDialogOpen(false);
      window.location.reload();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to disable organization');
    } finally {
      setIsDisabling(false);
    }
  };

  const handleEnable = async () => {
    setIsEnabling(true);
    try {
      await enableOrganizationAction(orgId);
      success('Organization enabled successfully');
      window.location.reload();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to enable organization');
    } finally {
      setIsEnabling(false);
    }
  };

  const handleDelete = async () => {
    if (confirmationName !== orgName) {
      error('Organization name does not match');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteOrganizationAction(orgId, confirmationName);
      success('Organization deleted permanently');
      setIsDeleteDialogOpen(false);
      window.location.href = '/app/organizations';
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to delete organization');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isActive ? (
            // Disable Section
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-red-100 bg-red-50/50">
              <div>
                <h3 className="font-medium text-gray-900">Disable Organization</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Temporarily disable this organization. All portal access will be blocked.
                  Tickets and data are preserved. This can be reversed.
                </p>
              </div>
              <Button
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 shrink-0"
                onClick={() => setIsDisableDialogOpen(true)}
              >
                <PowerOff className="h-4 w-4 mr-2" />
                Disable
              </Button>
            </div>
          ) : (
            // Enable Section (when disabled)
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-green-100 bg-green-50/50">
              <div>
                <h3 className="font-medium text-gray-900">Organization Disabled</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Disabled on {disabledAt ? new Date(disabledAt).toLocaleDateString() : 'Unknown date'}
                  {disabledBy ? ` by ${disabledBy}` : ''}
                </p>
              </div>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                onClick={handleEnable}
                disabled={isEnabling}
              >
                <Power className="h-4 w-4 mr-2" />
                {isEnabling ? 'Enabling...' : 'Enable Organization'}
              </Button>
            </div>
          )}

          {/* Delete Section - only shown when disabled */}
          {!isActive && (
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-red-200 bg-red-50">
              <div>
                <h3 className="font-medium text-red-900 flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete Organization
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  Permanently delete this organization and ALL its data including tickets,
                  articles, assets, and files. This action CANNOT be undone.
                </p>
              </div>
              <Button
                variant="destructive"
                className="shrink-0"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                Delete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disable Confirmation Dialog */}
      <Dialog open={isDisableDialogOpen} onOpenChange={setIsDisableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Organization</DialogTitle>
            <DialogDescription>
              Are you sure you want to disable <strong>{orgName}</strong>?
              <br /><br />
              All customer portal users will lose access immediately. The organization
              can be re-enabled at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDisableDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={isDisabling}
            >
              {isDisabling ? 'Disabling...' : 'Disable Organization'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete Organization Permanently
            </DialogTitle>
            <DialogDescription>
              This action <strong>CANNOT</strong> be undone. This will permanently delete
              <strong> {orgName}</strong> and all associated data.
              <br /><br />
              Type the organization name <strong>{orgName}</strong> to confirm:
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmationName}
            onChange={(e) => setConfirmationName(e.target.value)}
            placeholder={`Type "${orgName}" to confirm`}
            className="mt-4"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || confirmationName !== orgName}
            >
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
