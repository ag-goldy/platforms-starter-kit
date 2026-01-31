'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  removeUserFromOrgAction,
  updateUserRoleAction,
} from '@/app/app/actions/users';
import { useToast } from '@/components/ui/toast';
import { ChangePasswordDialog } from './change-password-dialog';
import { UpdateRoleDialog } from './update-role-dialog';
import type { CustomerRole, UserRole } from '@/lib/auth/roles';

interface UserDetailProps {
  user: {
    id: string;
    email: string;
    name: string | null;
    phone?: string | null;
    jobTitle?: string | null;
    department?: string | null;
    notes?: string | null;
    managerId?: string | null;
    manager?: {
      id: string;
      name: string | null;
      email: string;
    } | null;
    isInternal: boolean;
    createdAt: Date;
    memberships: Array<{
      id: string;
      role: UserRole;
      organization: {
        id: string;
        name: string;
        subdomain: string;
      };
    }>;
  };
}

export function UserDetail({ user }: UserDetailProps) {
  const [memberships, setMemberships] = useState(user.memberships);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState<{
    membershipId: string;
    orgId: string;
    currentRole: CustomerRole;
  } | null>(null);
  const { showToast } = useToast();
  const customerRoleSet = new Set<CustomerRole>(['CUSTOMER_ADMIN', 'REQUESTER', 'VIEWER']);
  const isCustomerRole = (role: UserRole): role is CustomerRole =>
    customerRoleSet.has(role as CustomerRole);

  const handleRemoveFromOrg = async (membershipId: string, orgId: string) => {
    if (!confirm('Are you sure you want to remove this user from the organization?')) {
      return;
    }

    try {
      await removeUserFromOrgAction(user.id, orgId);
      setMemberships(memberships.filter((m) => m.id !== membershipId));
      showToast('User removed from organization', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to remove user', 'error');
    }
  };

  const handleRoleUpdate = async (orgId: string, newRole: CustomerRole) => {
    try {
      await updateUserRoleAction({
        orgId,
        userId: user.id,
        role: newRole,
      });
      setMemberships(
        memberships.map((m) =>
          m.organization.id === orgId ? { ...m, role: newRole } : m
        )
      );
      setShowRoleDialog(null);
      showToast('User role updated', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update role', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <p className="text-gray-900">{user.email}</p>
          </div>
          {user.name && (
            <div>
              <label className="text-sm font-medium text-gray-700">Name</label>
              <p className="text-gray-900">{user.name}</p>
            </div>
          )}
          {user.phone && (
            <div>
              <label className="text-sm font-medium text-gray-700">Phone</label>
              <p className="text-gray-900">{user.phone}</p>
            </div>
          )}
          {(user.jobTitle || user.department) && (
            <div className="grid grid-cols-2 gap-4">
              {user.jobTitle && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Job Title</label>
                  <p className="text-gray-900">{user.jobTitle}</p>
                </div>
              )}
              {user.department && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Department</label>
                  <p className="text-gray-900">{user.department}</p>
                </div>
              )}
            </div>
          )}
          {user.notes && (
            <div>
              <label className="text-sm font-medium text-gray-700">Notes</label>
              <p className="text-gray-900 whitespace-pre-wrap">{user.notes}</p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700">Type</label>
            <div className="mt-1">
              {user.isInternal ? (
                <Badge variant="default">Internal User</Badge>
              ) : (
                <Badge variant="outline">Customer User</Badge>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Created</label>
            <p className="text-gray-900">
              {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          {memberships.length === 0 ? (
            <p className="text-sm text-gray-500">User is not a member of any organization</p>
          ) : (
            <div className="space-y-4">
              {memberships.map((membership) => (
                <div
                  key={membership.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div>
                    <div className="font-medium">{membership.organization.name}</div>
                    <div className="text-sm text-gray-600">
                      {membership.organization.subdomain}
                    </div>
                    <div className="mt-1">
                      <Badge variant="outline">{membership.role}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!isCustomerRole(membership.role)) return;
                        setShowRoleDialog({
                          membershipId: membership.id,
                          orgId: membership.organization.id,
                          currentRole: membership.role,
                        });
                      }}
                      disabled={!isCustomerRole(membership.role)}
                    >
                      Change Role
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleRemoveFromOrg(membership.id, membership.organization.id)
                      }
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowPasswordDialog(true)}>
            Change Password
          </Button>
        </CardContent>
      </Card>

      {showPasswordDialog && (
        <ChangePasswordDialog
          userId={user.id}
          onClose={() => setShowPasswordDialog(false)}
          onSuccess={() => {
            setShowPasswordDialog(false);
            showToast('Password changed successfully', 'success');
          }}
        />
      )}

      {showRoleDialog && (
        <UpdateRoleDialog
          orgId={showRoleDialog.orgId}
          currentRole={showRoleDialog.currentRole}
          onClose={() => setShowRoleDialog(null)}
          onUpdate={(newRole) => handleRoleUpdate(showRoleDialog.orgId, newRole)}
        />
      )}
    </div>
  );
}
