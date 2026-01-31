/**
 * Canned responses queries
 */

import { db } from '@/db';
import { cannedResponses } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function getCannedResponses(orgId: string) {
  return db.query.cannedResponses.findMany({
    where: eq(cannedResponses.orgId, orgId),
    orderBy: (responses, { asc }) => [asc(responses.name)],
  });
}

export async function getCannedResponseById(id: string, orgId: string) {
  return db.query.cannedResponses.findFirst({
    where: and(eq(cannedResponses.id, id), eq(cannedResponses.orgId, orgId)),
  });
}

export async function getCannedResponseByShortcut(orgId: string, shortcut: string) {
  return db.query.cannedResponses.findFirst({
    where: and(
      eq(cannedResponses.orgId, orgId),
      eq(cannedResponses.shortcut, shortcut)
    ),
  });
}

