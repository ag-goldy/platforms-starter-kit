import { db } from '@/db';
import { services } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function getServicesByOrg(orgId: string) {
  return db.query.services.findMany({
    where: eq(services.orgId, orgId),
    orderBy: (table, { asc }) => [asc(table.name)],
  });
}

export async function getServiceById(serviceId: string, orgId?: string) {
  const conditions = [eq(services.id, serviceId)];
  if (orgId) {
    conditions.push(eq(services.orgId, orgId));
  }
  return db.query.services.findFirst({
    where: and(...conditions),
  });
}

