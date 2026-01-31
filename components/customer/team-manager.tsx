'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';

interface TeamMember {
  membershipId: string;
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  deactivatedAt: Date | null;
  createdAt: Date;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
}

interface CustomerTeamManagerProps {
  orgId: string;
  orgName: string;
  subdomain: string;
  members: TeamMember[];
  pendingInvitations: PendingInvitation[];
  currentUserId: string;
  isAdmin: boolean;
}

export function CustomerTeamManager(props: CustomerTeamManagerProps) {
  const { orgId, members, pendingInvitations, currentUserId, isAdmin } = props;
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'REQUESTER' | 'VIEWER'>('REQUESTER');
  const [isInviting, setIsInviting] = useState(false);
  const [invitations, setInvitations] = useState(pendingInvitations);
  const [teamMembers, setTeamMembers] = useState(members);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [togglingMemberId, setTogglingMemberId] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setIsInviting(true);
    try {
      const response = await fetch('/api/customer/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send invitation');
      }

      const data = await response.json();
      setInvitations([...invitations, data.invitation]);
      setInviteEmail('');
      setShowInviteForm(false);
      showToast('Invitation sent!', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to invite', 'error');
    } finally {
      setIsInviting(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const response = await fetch('/api/customer/team/invite', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel invitation');
      }

      setInvitations(invitations.filter(i => i.id !== invitationId));
      showToast('Invitation cancelled', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to cancel', 'error');
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === 'CUSTOMER_ADMIN') return 'default';
    if (role === 'REQUESTER') return 'outline';
    return 'secondary';
  };

  const handleRoleChange = async (membershipId: string, role: string) => {
    setUpdatingMemberId(membershipId);
    try {
      const response = await fetch('/api/customer/team/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId, role }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update role');
      }

      setTeamMembers((prev) =>
        prev.map((member) =>
          member.membershipId === membershipId ? { ...member, role } : member
        )
      );
      showToast('Role updated', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update role', 'error');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleToggleMemberStatus = async (membershipId: string, nextActive: boolean) => {
    if (!nextActive) {
      const confirmed = confirm('Deactivate this member? They will be signed out immediately.');
      if (!confirmed) {
        return;
      }
    }

    setTogglingMemberId(membershipId);
    try {
      const response = await fetch('/api/customer/team/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId, isActive: nextActive }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update member');
      }

      setTeamMembers((prev) =>
        prev.map((member) =>
          member.membershipId === membershipId
            ? {
                ...member,
                isActive: nextActive,
                deactivatedAt: nextActive ? null : new Date(),
              }
            : member
        )
      );
      showToast(nextActive ? 'Member reactivated' : 'Member deactivated', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update member', 'error');
    } finally {
      setTogglingMemberId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>{teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}</CardDescription>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowInviteForm(!showInviteForm)}>
              {showInviteForm ? 'Cancel' : 'Invite Member'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showInviteForm && (
            <form onSubmit={handleInvite} className="mb-6 p-4 border rounded-lg bg-gray-50">
              <h4 className="font-medium mb-4">Invite New Member</h4>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'REQUESTER' | 'VIEWER')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="REQUESTER">Requester - Can create and view tickets</option>
                    <option value="VIEWER">Viewer - Can only view tickets</option>
                  </select>
                </div>
                <Button type="submit" disabled={isInviting}>
                  {isInviting ? 'Sending...' : 'Send Invitation'}
                </Button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between py-3 border-b last:border-0"
              >
                <div>
                  <div className="font-medium">
                    {member.name || member.email}
                    {member.id === currentUserId && (
                      <span className="ml-2 text-xs text-gray-500">(You)</span>
                    )}
                  </div>
                  {member.name && (
                    <div className="text-sm text-gray-500">{member.email}</div>
                  )}
                  {!member.isActive && (
                    <div className="text-xs text-gray-500">
                      Deactivated {member.deactivatedAt ? new Date(member.deactivatedAt).toLocaleDateString() : ''}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {isAdmin && member.id !== currentUserId ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.membershipId, e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                      disabled={!member.isActive || updatingMemberId === member.membershipId}
                    >
                      <option value="CUSTOMER_ADMIN">Customer Admin</option>
                      <option value="REQUESTER">Requester</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                  ) : (
                    <Badge variant={getRoleBadgeVariant(member.role)}>
                      {member.role.replace('_', ' ')}
                    </Badge>
                  )}
                  {!member.isActive && (
                    <Badge variant="secondary">Deactivated</Badge>
                  )}
                  {isAdmin && member.id !== currentUserId && (
                    member.isActive ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleMemberStatus(member.membershipId, false)}
                        disabled={togglingMemberId === member.membershipId}
                        className="text-red-600 hover:text-red-700"
                      >
                        {togglingMemberId === member.membershipId ? 'Deactivating...' : 'Deactivate'}
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleMemberStatus(member.membershipId, true)}
                        disabled={togglingMemberId === member.membershipId}
                      >
                        {togglingMemberId === member.membershipId ? 'Reactivating...' : 'Reactivate'}
                      </Button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {isAdmin && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>Invitations that haven&apos;t been accepted yet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div>
                    <div className="font-medium">{invitation.email}</div>
                    <div className="text-sm text-gray-500">
                      Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{invitation.role.replace('_', ' ')}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelInvitation(invitation.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
