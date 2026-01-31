'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface InviteUserDialogProps {
  orgName: string;
  onClose: () => void;
  onInvite: (data: {
    email: string;
    role: CustomerRole;
    sendEmail: boolean;
  }) => Promise<void>;
}

export function InviteUserDialog({
  orgName,
  onClose,
  onInvite,
}: InviteUserDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CustomerRole>('REQUESTER');
  const [sendEmail, setSendEmail] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    try {
      await onInvite({
        email: email.trim(),
        role,
        sendEmail,
      });
    } catch {
      // Error handling is done in parent component
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User to {orgName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as CustomerRole)}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CUSTOMER_ADMIN">Customer Admin</SelectItem>
                <SelectItem value="REQUESTER">Requester</SelectItem>
                <SelectItem value="VIEWER">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="rounded"
              />
              <span>Send invitation email</span>
            </Label>
            <p className="text-xs text-gray-500 ml-6">
              {sendEmail
                ? 'An invitation email will be sent to the user'
                : 'Generate an invitation link that you can share manually'}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !email.trim()}>
              {isLoading ? 'Inviting...' : sendEmail ? 'Send Invitation' : 'Create Link'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
