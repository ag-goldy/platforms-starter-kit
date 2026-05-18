import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth as requireAuthFromPermissions } from './permissions';

// Re-export requireAuth for backwards compatibility
export const requireAuth = requireAuthFromPermissions;

export async function getServerSession() {
  const session = await auth();
  return session;
}

export async function getServerUser() {
  const session = await auth();
  if (!session?.user?.email) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, session.user.email),
    with: {
      memberships: {
        with: {
          organization: true,
        },
      },
    },
  });

  return user;
}
