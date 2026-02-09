import { requireInternalAdmin } from '@/lib/auth/permissions';
import { db } from '@/db';
import { InternalGroupsManager } from '@/components/admin/internal-groups-manager';
import { getInternalUsers } from '@/lib/users/queries';

export default async function InternalGroupsPage() {
  await requireInternalAdmin();

  const [groups, internalUsers, organizations] = await Promise.all([
    db.query.internalGroups.findMany({
      with: {
        memberships: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        organization: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: (groupList, { asc }) => [asc(groupList.name)],
    }),
    getInternalUsers(),
    db.query.organizations.findMany({
      columns: {
        id: true,
        name: true,
      },
      orderBy: (orgList, { asc }) => [asc(orgList.name)],
    }),
  ]);

  const normalizedGroups = groups.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    scope: group.scope,
    roleType: group.roleType,
    orgId: group.orgId,
    orgName: (group.organization as { name?: string } | undefined)?.name ?? null,
    members: group.memberships
      .filter((membership) => membership.user)
      .map((membership) => ({
        id: membership.id,
        userId: membership.userId,
        role: membership.role,
        user: {
          id: membership.user!.id,
          name: membership.user!.name,
          email: membership.user!.email,
        },
      })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Internal Groups</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create internal groups and assign internal users with admin roles.
        </p>
      </div>

      <InternalGroupsManager
        groups={normalizedGroups}
        internalUsers={internalUsers}
        organizations={organizations}
      />
    </div>
  );
}
