import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function getInternalUsers() {
  return db.query.users.findMany({
    where: eq(users.isInternal, true),
    columns: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: (userList, { asc }) => [asc(userList.name), asc(userList.email)],
  });
}
