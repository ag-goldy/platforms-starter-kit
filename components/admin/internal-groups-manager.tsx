'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import {
  addInternalGroupMemberAction,
  createInternalGroupAction,
  deleteInternalGroupAction,
  removeInternalGroupMemberAction,
  updateInternalGroupMemberRoleAction,
} from '@/app/app/actions/internal-groups';

type InternalGroupRole = 'ADMIN' | 'MEMBER';
type InternalGroupScope = 'PLATFORM' | 'ORG';
type InternalGroupRoleType =
  | 'PLATFORM_SUPER_ADMIN'
  | 'PLATFORM_ADMIN'
  | 'SECURITY_ADMIN'
  | 'COMPLIANCE_AUDITOR'
  | 'BILLING_ADMIN'
  | 'INTEGRATION_ADMIN'
  | 'ORG_ADMIN'
  | 'SUPPORT_OPS_ADMIN'
  | 'TEAM_QUEUE_MANAGER'
  | 'SUPERVISOR'
  | 'AGENT';

type InternalUserOption = {
  id: string;
  name: string | null;
  email: string;
};

type InternalGroupMember = {
  id: string;
  userId: string;
  role: InternalGroupRole;
  user: InternalUserOption;
};

type InternalGroup = {
  id: string;
  name: string;
  description: string | null;
  scope: InternalGroupScope;
  roleType: InternalGroupRoleType;
  orgId: string | null;
  orgName: string | null;
  members: InternalGroupMember[];
};

interface InternalGroupsManagerProps {
  groups: InternalGroup[];
  internalUsers: InternalUserOption[];
  organizations: Array<{ id: string; name: string }>;
}

const PLATFORM_ROLE_OPTIONS: Array<{ value: InternalGroupRoleType; label: string }> = [
  { value: 'PLATFORM_SUPER_ADMIN', label: 'Platform Super Admin' },
  { value: 'PLATFORM_ADMIN', label: 'Platform Admin' },
  { value: 'SECURITY_ADMIN', label: 'Security Admin' },
  { value: 'COMPLIANCE_AUDITOR', label: 'Compliance / Auditor (Read-only)' },
  { value: 'BILLING_ADMIN', label: 'Billing Admin' },
  { value: 'INTEGRATION_ADMIN', label: 'Integration Admin' },
];

const ORG_ROLE_OPTIONS: Array<{ value: InternalGroupRoleType; label: string }> = [
  { value: 'ORG_ADMIN', label: 'Org Admin' },
  { value: 'SUPPORT_OPS_ADMIN', label: 'Support Ops Admin' },
  { value: 'TEAM_QUEUE_MANAGER', label: 'Team/Queue Manager' },
  { value: 'SUPERVISOR', label: 'Supervisor / Team Lead' },
  { value: 'AGENT', label: 'Agent' },
];

const ROLE_LABELS: Record<InternalGroupRoleType, string> = {
  PLATFORM_SUPER_ADMIN: 'Platform Super Admin',
  PLATFORM_ADMIN: 'Platform Admin',
  SECURITY_ADMIN: 'Security Admin',
  COMPLIANCE_AUDITOR: 'Compliance / Auditor (Read-only)',
  BILLING_ADMIN: 'Billing Admin',
  INTEGRATION_ADMIN: 'Integration Admin',
  ORG_ADMIN: 'Org Admin',
  SUPPORT_OPS_ADMIN: 'Support Ops Admin',
  TEAM_QUEUE_MANAGER: 'Team/Queue Manager',
  SUPERVISOR: 'Supervisor / Team Lead',
  AGENT: 'Agent',
};

export function InternalGroupsManager({
  groups: initialGroups,
  internalUsers,
  organizations,
}: InternalGroupsManagerProps) {
  const [groups, setGroups] = useState(initialGroups);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupScope, setNewGroupScope] = useState<InternalGroupScope>('PLATFORM');
  const [newGroupRoleType, setNewGroupRoleType] =
    useState<InternalGroupRoleType>('PLATFORM_ADMIN');
  const [newGroupOrgId, setNewGroupOrgId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [memberSelections, setMemberSelections] = useState<
    Record<string, { userId: string; role: InternalGroupRole }>
  >({});
  const [busyMembershipId, setBusyMembershipId] = useState<string | null>(null);
  const [busyGroupId, setBusyGroupId] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleCreateGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newGroupName.trim()) {
      showToast('Group name is required', 'error');
      return;
    }

    setIsCreating(true);
    try {
      if (newGroupScope === 'ORG' && !newGroupOrgId) {
        showToast('Select an organization for org-scoped groups', 'error');
        return;
      }

      const result = await createInternalGroupAction({
        name: newGroupName,
        description: newGroupDescription,
        scope: newGroupScope,
        roleType: newGroupRoleType,
        orgId: newGroupScope === 'ORG' ? newGroupOrgId : null,
      });
      const createdOrgName =
        newGroupScope === 'ORG'
          ? organizations.find((org) => org.id === newGroupOrgId)?.name ?? null
          : null;
      setGroups((prev) =>
        [
          ...prev,
          {
            ...result.group,
            members: [],
            orgName: createdOrgName,
          },
        ].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setNewGroupName('');
      setNewGroupDescription('');
      setNewGroupScope('PLATFORM');
      setNewGroupRoleType('PLATFORM_ADMIN');
      setNewGroupOrgId('');
      showToast('Internal group created', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create group', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Delete this group and all its memberships?')) {
      return;
    }

    setBusyGroupId(groupId);
    try {
      await deleteInternalGroupAction(groupId);
      setGroups((prev) => prev.filter((group) => group.id !== groupId));
      showToast('Group deleted', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete group', 'error');
    } finally {
      setBusyGroupId(null);
    }
  };

  const handleAddMember = async (groupId: string) => {
    const selection = memberSelections[groupId];
    if (!selection?.userId) {
      showToast('Select a user to add', 'error');
      return;
    }

    setBusyGroupId(groupId);
    try {
      const result = await addInternalGroupMemberAction({
        groupId,
        userId: selection.userId,
        role: selection.role,
      });
      setGroups((prev) =>
        prev.map((group) =>
          group.id === groupId
            ? { ...group, members: [...group.members, result.membership] }
            : group
        )
      );
      setMemberSelections((prev) => ({
        ...prev,
        [groupId]: { userId: '', role: selection.role },
      }));
      showToast('Member added', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to add member', 'error');
    } finally {
      setBusyGroupId(null);
    }
  };

  const handleRoleChange = async (
    groupId: string,
    membershipId: string,
    role: InternalGroupRole
  ) => {
    setBusyMembershipId(membershipId);
    try {
      await updateInternalGroupMemberRoleAction({ groupId, membershipId, role });
      setGroups((prev) =>
        prev.map((group) =>
          group.id === groupId
            ? {
                ...group,
                members: group.members.map((member) =>
                  member.id === membershipId ? { ...member, role } : member
                ),
              }
            : group
        )
      );
      showToast('Role updated', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update role', 'error');
    } finally {
      setBusyMembershipId(null);
    }
  };

  const handleRemoveMember = async (groupId: string, membershipId: string) => {
    if (!confirm('Remove this member from the group?')) {
      return;
    }

    setBusyMembershipId(membershipId);
    try {
      await removeInternalGroupMemberAction({ groupId, membershipId });
      setGroups((prev) =>
        prev.map((group) =>
          group.id === groupId
            ? {
                ...group,
                members: group.members.filter((member) => member.id !== membershipId),
              }
            : group
        )
      );
      showToast('Member removed', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to remove member', 'error');
    } finally {
      setBusyMembershipId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Internal Group</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="group-scope">Scope</Label>
                <select
                  id="group-scope"
                  value={newGroupScope}
                  onChange={(event) => {
                    const scope = event.target.value as InternalGroupScope;
                    setNewGroupScope(scope);
                    const defaultRole =
                      scope === 'PLATFORM'
                        ? PLATFORM_ROLE_OPTIONS[0].value
                        : ORG_ROLE_OPTIONS[0].value;
                    setNewGroupRoleType(defaultRole);
                    if (scope === 'PLATFORM') {
                      setNewGroupOrgId('');
                    }
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="PLATFORM">Platform (global)</option>
                  <option value="ORG">Organization</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-role">Role</Label>
                <select
                  id="group-role"
                  value={newGroupRoleType}
                  onChange={(event) =>
                    setNewGroupRoleType(event.target.value as InternalGroupRoleType)
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {(newGroupScope === 'PLATFORM' ? PLATFORM_ROLE_OPTIONS : ORG_ROLE_OPTIONS).map(
                    (role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
            {newGroupScope === 'ORG' && (
              <div className="space-y-2">
                <Label htmlFor="group-org">Organization</Label>
                <select
                  id="group-org"
                  value={newGroupOrgId}
                  onChange={(event) => setNewGroupOrgId(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select organization</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="e.g. Escalations Team"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-description">Description (optional)</Label>
              <Textarea
                id="group-description"
                value={newGroupDescription}
                onChange={(event) => setNewGroupDescription(event.target.value)}
                placeholder="What is this group used for?"
              />
            </div>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Group'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-gray-500">
            No internal groups yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const availableUsers = internalUsers.filter(
              (user) => !group.members.some((member) => member.user.id === user.id)
            );
            const selection = memberSelections[group.id] || { userId: '', role: 'MEMBER' };

            return (
              <Card key={group.id}>
                <CardHeader className="flex items-center justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <CardTitle>{group.name}</CardTitle>
                    {group.description && (
                      <p className="mt-1 text-sm text-gray-600">{group.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <Badge variant="outline">
                        {group.scope === 'PLATFORM' ? 'Platform' : 'Organization'}
                      </Badge>
                      <Badge variant="secondary">{ROLE_LABELS[group.roleType]}</Badge>
                      {group.scope === 'ORG' && group.orgName && (
                        <Badge variant="outline">{group.orgName}</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleDeleteGroup(group.id)}
                    disabled={busyGroupId === group.id}
                  >
                    {busyGroupId === group.id ? 'Deleting...' : 'Delete Group'}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-700">Members</h3>
                    {group.members.length === 0 ? (
                      <p className="text-sm text-gray-500">No members yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {group.members.map((member) => (
                          <div
                            key={member.id}
                            className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <div className="font-medium">
                                {member.user.name || member.user.email}
                              </div>
                              {member.user.name && (
                                <div className="text-sm text-gray-500">
                                  {member.user.email}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={member.role}
                                onChange={(event) =>
                                  handleRoleChange(
                                    group.id,
                                    member.id,
                                    event.target.value as InternalGroupRole
                                  )
                                }
                                className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                                disabled={busyMembershipId === member.id}
                              >
                                <option value="ADMIN">Admin</option>
                                <option value="MEMBER">Member</option>
                              </select>
                              <Badge variant={member.role === 'ADMIN' ? 'default' : 'outline'}>
                                {member.role}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleRemoveMember(group.id, member.id)}
                                disabled={busyMembershipId === member.id}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-700">Add member</h3>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        value={selection.userId}
                        onChange={(event) =>
                          setMemberSelections((prev) => ({
                            ...prev,
                            [group.id]: {
                              userId: event.target.value,
                              role: selection.role,
                            },
                          }))
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:w-64"
                      >
                        <option value="">Select internal user</option>
                        {availableUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name ? `${user.name} (${user.email})` : user.email}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selection.role}
                        onChange={(event) =>
                          setMemberSelections((prev) => ({
                            ...prev,
                            [group.id]: {
                              userId: selection.userId,
                              role: event.target.value as InternalGroupRole,
                            },
                          }))
                        }
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="MEMBER">Member</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <Button
                        onClick={() => handleAddMember(group.id)}
                        disabled={!selection.userId || busyGroupId === group.id}
                      >
                        {busyGroupId === group.id ? 'Adding...' : 'Add'}
                      </Button>
                    </div>
                    {availableUsers.length === 0 && (
                      <p className="text-xs text-gray-500">
                        All internal users are already in this group.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
