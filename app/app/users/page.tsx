import { requireInternalRole } from '@/lib/auth/permissions';
import { getAllUsersAction } from '@/app/app/actions/users';
import { getAllOrganizationsAction } from '@/app/app/actions/organizations';
import { UsersList } from '@/components/users/users-list';
import { CreateUserDialog } from '@/components/users/create-user-dialog';

export default async function UsersPage() {
  await requireInternalRole();
  const [users, organizations] = await Promise.all([
    getAllUsersAction(),
    getAllOrganizationsAction(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage all users across all organizations
          </p>
        </div>
        <CreateUserDialog organizations={organizations} />
      </div>

      <UsersList users={users} />
    </div>
  );
}
