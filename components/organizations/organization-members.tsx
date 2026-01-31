'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { inviteUserAction, updateUserRoleAction } from '@/app/app/actions/organizations';
import { Membership, User } from '@/db/schema';
import { Badge } from '@/components/ui/badge';

interface OrganizationMembersProps {
  orgId: string;
  memberships: (Membership & { user: User })[];
}

export function OrganizationMembers({ orgId, memberships }: OrganizationMembersProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  type CustomerRole = 'CUSTOMER_ADMIN' | 'REQUESTER' | 'VIEWER';
  const [role, setRole] = useState<CustomerRole>('REQUESTER');
  const [isInviting, setIsInviting] = useState(false);

  async function handleInvite() {
    if (!email.trim()) return;
    setIsInviting(true);
    try {
      await inviteUserAction({ orgId, email, name: name || undefined, role });
      setEmail('');
      setName('');
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to invite user';
      alert(message);
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: CustomerRole) {
    try {
      await updateUserRoleAction({ orgId, userId, role: newRole });
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update role';
      alert(message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 border-b pb-4">
        <h3 className="font-medium">Invite User</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              type="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-name">Name (optional)</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as CustomerRole)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CUSTOMER_ADMIN">Customer Admin</SelectItem>
                <SelectItem value="REQUESTER">Requester</SelectItem>
                <SelectItem value="VIEWER">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleInvite} disabled={!email.trim() || isInviting}>
          {isInviting ? 'Inviting...' : 'Invite User'}
        </Button>
      </div>

      <div className="space-y-2">
        {memberships.length === 0 ? (
          <p className="text-sm text-gray-500">No members yet.</p>
        ) : (
          memberships.map((membership) => (
            <div
              key={membership.id}
              className="flex items-center justify-between rounded-lg border bg-white p-4"
            >
              <div>
                <p className="font-medium">{membership.user.name || membership.user.email}</p>
                <p className="text-sm text-gray-600">{membership.user.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge>{membership.role}</Badge>
                <Select
                  value={membership.role}
                  onValueChange={(value) => handleRoleChange(membership.userId, value as CustomerRole)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUSTOMER_ADMIN">Customer Admin</SelectItem>
                    <SelectItem value="REQUESTER">Requester</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

