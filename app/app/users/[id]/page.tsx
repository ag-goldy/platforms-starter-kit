import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { users, memberships, organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { UserDetail } from '@/components/users/user-detail';
import Link from 'next/link';

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireInternalRole();
  const resolvedParams = await params;
  const userId = resolvedParams.id;

  const usersList = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const userData = usersList[0];

  // Fetch manager if managerId exists
  let manager = null;
  if (userData?.managerId) {
    const managerList = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userData.managerId))
      .limit(1);
    manager = managerList[0] || null;
  }

  if (!userData) {
    notFound();
  }

  // Get memberships with organization details
  const membershipsList = await db
    .select({
      id: memberships.id,
      role: memberships.role,
      orgId: memberships.orgId,
      orgName: organizations.name,
      orgSubdomain: organizations.subdomain,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .where(eq(memberships.userId, userId));

  const user = {
    ...userData,
    manager,
    memberships: membershipsList.map((m) => ({
      id: m.id,
      role: m.role,
      organization: {
        id: m.orgId,
        name: m.orgName,
        subdomain: m.orgSubdomain,
      },
    })),
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/app/users"
          className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
        >
          ← Back to users
        </Link>
        <h1 className="text-2xl font-bold">{user.name || user.email}</h1>
        {user.name && (
          <p className="text-sm text-gray-600">{user.email}</p>
        )}
      </div>

      <UserDetail user={user} />
    </div>
  );
}

