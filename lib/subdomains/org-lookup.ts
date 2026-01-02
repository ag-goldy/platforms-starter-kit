import { db } from '@/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function getOrgBySubdomain(subdomain: string) {
  return db.query.organizations.findFirst({
    where: eq(organizations.subdomain, subdomain),
  });
}

