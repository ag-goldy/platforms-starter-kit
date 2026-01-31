'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CustomerRole } from '@/lib/auth/roles';

interface UpdateRoleDialogProps {
  orgId: string;
  currentRole: CustomerRole;
  onClose: () => void;
  onUpdate: (newRole: CustomerRole) => Promise<void>;
}

export function UpdateRoleDialog(props: UpdateRoleDialogProps) {
  const { currentRole, onClose, onUpdate } = props;
  const [selectedRole, setSelectedRole] = useState<CustomerRole>(currentRole);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole === currentRole) {
      onClose();
      return;
    }

    setIsLoading(true);
    try {
      await onUpdate(selectedRole);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Role</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Role</label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setSelectedRole(value as CustomerRole)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CUSTOMER_ADMIN">Customer Admin</SelectItem>
                <SelectItem value="REQUESTER">Requester</SelectItem>
                <SelectItem value="VIEWER">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Role'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
