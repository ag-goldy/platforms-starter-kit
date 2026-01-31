'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  inviteUserAction,
  createInvitationLinkAction,
  cancelInvitationAction,
  resendInvitationAction,
  removeUserFromOrgAction,
  updateUserRoleAction,
  updateUserInfoAction,
} from '@/app/app/actions/users';
import { useToast } from '@/components/ui/toast';
import { InviteUserDialog } from './invite-user-dialog';
import { UpdateRoleDialog } from '@/components/users/update-role-dialog';
import { EditUserDialog } from './edit-user-dialog';
import { Pencil, Trash2, Mail } from 'lucide-react';
import type { CustomerRole, UserRole } from '@/lib/auth/roles';

interface Member {
  id: string;
  role: UserRole;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    name: string | null;
    phone?: string | null;
    jobTitle?: string | null;
    department?: string | null;
    notes?: string | null;
    managerId?: string | null;
    isInternal?: boolean;
    createdAt: Date;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  expiresAt: Date;
  createdAt: Date;
  inviter: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface OrganizationTeamManagerProps {
  orgId: string;
  orgName: string;
  members: Member[];
  invitations: Invitation[];
}

export function OrganizationTeamManager({
  orgId,
  orgName,
  members: initialMembers,
  invitations: initialInvitations,
}: OrganizationTeamManagerProps) {
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState<{
    userId: string;
    currentRole: CustomerRole;
  } | null>(null);
  const [showEditDialog, setShowEditDialog] = useState<{
    userId: string;
    currentName: string | null;
    currentEmail: string;
    currentPhone?: string | null;
    currentJobTitle?: string | null;
    currentDepartment?: string | null;
    currentNotes?: string | null;
    currentManagerId?: string | null;
    isInternal?: boolean;
  } | null>(null);
  const { showToast } = useToast();
  const customerRoleSet = new Set<CustomerRole>(['CUSTOMER_ADMIN', 'REQUESTER', 'VIEWER']);
  const isCustomerRole = (role: UserRole): role is CustomerRole =>
    customerRoleSet.has(role as CustomerRole);

  const handleInvite = async (data: {
    email: string;
    role: CustomerRole;
    sendEmail: boolean;
  }) => {
    try {
      if (data.sendEmail) {
        await inviteUserAction({
          orgId,
          email: data.email,
          role: data.role,
        });
        showToast('Invitation sent successfully', 'success');
      } else {
        const result = await createInvitationLinkAction({
          orgId,
          email: data.email,
          role: data.role,
        });
        await navigator.clipboard.writeText(result.invitationLink);
        showToast('Invitation link created and copied to clipboard', 'success');
      }
      setShowInviteDialog(false);
      // Refresh invitations
      window.location.reload();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to send invitation', 'error');
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) {
      return;
    }

    try {
      await cancelInvitationAction(invitationId, orgId);
      setInvitations(invitations.filter((i) => i.id !== invitationId));
      showToast('Invitation cancelled', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to cancel invitation', 'error');
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      await resendInvitationAction(invitationId);
      showToast('Invitation email resent', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to resend invitation', 'error');
    }
  };

  const handleRemoveMember = async (userId: string, membershipId: string) => {
    if (!confirm('Are you sure you want to remove this member from the organization?')) {
      return;
    }

    try {
      await removeUserFromOrgAction(userId, orgId);
      setMembers(members.filter((m) => m.id !== membershipId));
      showToast('Member removed', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to remove member', 'error');
    }
  };

  const handleRoleUpdate = async (userId: string, newRole: CustomerRole) => {
    try {
      await updateUserRoleAction({
        orgId,
        userId,
        role: newRole,
      });
      setMembers(
        members.map((m) =>
          m.user.id === userId ? { ...m, role: newRole } : m
        )
      );
      setShowRoleDialog(null);
      showToast('Role updated', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update role', 'error');
    }
  };

  const handleUserInfoUpdate = async (data: {
    name: string | null;
    email: string;
    phone?: string | null;
    jobTitle?: string | null;
    department?: string | null;
    notes?: string | null;
    managerId?: string | null;
  }) => {
    if (!showEditDialog) return;
    
    try {
      await updateUserInfoAction({
        userId: showEditDialog.userId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        jobTitle: data.jobTitle,
        department: data.department,
        notes: data.notes,
        managerId: data.managerId,
      });
      setMembers(
        members.map((m) =>
          m.user.id === showEditDialog.userId
            ? {
                ...m,
                user: {
                  ...m.user,
                  name: data.name,
                  email: data.email,
                  phone: data.phone,
                  jobTitle: data.jobTitle,
                  department: data.department,
                  notes: data.notes,
                  managerId: data.managerId,
                },
              }
            : m
        )
      );
      setShowEditDialog(null);
      showToast('User information updated', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update user information', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Team Members</h2>
          <p className="text-sm text-muted-foreground">
            Manage members and send invitations
          </p>
        </div>
        <Button onClick={() => setShowInviteDialog(true)}>
          Invite Member
        </Button>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div>
                    <div className="font-medium">{invitation.email}</div>
                    <div className="text-sm text-gray-600">
                      Role: <Badge variant="outline">{invitation.role}</Badge>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResendInvitation(invitation.id)}
                    >
                      <Mail className="h-4 w-4 mr-1" />
                      Resend
                    </Button>
                    <Button
                      variant="outline"
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

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-gray-500">No members yet. Invite your first member to get started.</p>
          ) : (
            <div className="space-y-4">
              {members.map((member) => {
                const customerRole = isCustomerRole(member.role) ? member.role : null;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div>
                      <div className="font-medium">{member.user.name || member.user.email}</div>
                      {member.user.name && (
                        <div className="text-sm text-gray-600">{member.user.email}</div>
                      )}
                      <div className="mt-1">
                        <Badge variant="outline">{member.role}</Badge>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        Joined: {new Date(member.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setShowEditDialog({
                            userId: member.user.id,
                            currentName: member.user.name,
                            currentEmail: member.user.email,
                            currentPhone: member.user.phone,
                            currentJobTitle: member.user.jobTitle,
                            currentDepartment: member.user.department,
                            currentNotes: member.user.notes,
                            currentManagerId: member.user.managerId,
                            isInternal: member.user.isInternal,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      {customerRole && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setShowRoleDialog({
                              userId: member.user.id,
                              currentRole: customerRole,
                            })
                          }
                        >
                          Change Role
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveMember(member.user.id, member.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {showInviteDialog && (
        <InviteUserDialog
          orgName={orgName}
          onClose={() => setShowInviteDialog(false)}
          onInvite={handleInvite}
        />
      )}

      {showRoleDialog && (
        <UpdateRoleDialog
          orgId={orgId}
          currentRole={showRoleDialog.currentRole}
          onClose={() => setShowRoleDialog(null)}
          onUpdate={(newRole) => handleRoleUpdate(showRoleDialog.userId, newRole)}
        />
      )}

      {showEditDialog && (
        <EditUserDialog
          userId={showEditDialog.userId}
          currentName={showEditDialog.currentName}
          currentEmail={showEditDialog.currentEmail}
          currentPhone={showEditDialog.currentPhone}
          currentJobTitle={showEditDialog.currentJobTitle}
          currentDepartment={showEditDialog.currentDepartment}
          currentNotes={showEditDialog.currentNotes}
          currentManagerId={showEditDialog.currentManagerId}
          isInternal={showEditDialog.isInternal}
          onClose={() => setShowEditDialog(null)}
          onUpdate={handleUserInfoUpdate}
        />
      )}
    </div>
  );
}
