import { db } from '@/db';

export async function getOrganizations() {
  return db.query.organizations.findMany({
    orderBy: (orgs, { asc }) => [asc(orgs.name)],
  });
}
