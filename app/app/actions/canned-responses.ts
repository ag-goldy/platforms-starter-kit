'use server';

import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { cannedResponses } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCannedResponses, getCannedResponseById } from '@/lib/canned-responses/queries';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const cannedResponseSchema = z.object({
  name: z.string().min(1).max(200),
  content: z.string().min(1),
  shortcut: z.string().max(50).optional().nullable(),
});

/**
 * Get all canned responses for an organization
 */
export async function getCannedResponsesAction(orgId: string) {
  await requireInternalRole();
  return getCannedResponses(orgId);
}

/**
 * Create a new canned response
 */
export async function createCannedResponseAction(
  orgId: string,
  data: { name: string; content: string; shortcut?: string | null }
) {
  const user = await requireInternalRole();
  const validated = cannedResponseSchema.parse(data);

  const [response] = await db
    .insert(cannedResponses)
    .values({
      orgId,
      name: validated.name,
      content: validated.content,
      shortcut: validated.shortcut || null,
      createdBy: user.id,
    })
    .returning();

  revalidatePath('/app');
  return response;
}

/**
 * Update a canned response
 */
export async function updateCannedResponseAction(
  id: string,
  orgId: string,
  data: { name?: string; content?: string; shortcut?: string | null }
) {
  await requireInternalRole();
  const existing = await getCannedResponseById(id, orgId);
  if (!existing) {
    throw new Error('Canned response not found');
  }

  const validated = cannedResponseSchema.partial().parse(data);

  const [updated] = await db
    .update(cannedResponses)
    .set({
      ...validated,
      updatedAt: new Date(),
    })
    .where(and(eq(cannedResponses.id, id), eq(cannedResponses.orgId, orgId)))
    .returning();

  revalidatePath('/app');
  return updated;
}

/**
 * Delete a canned response
 */
export async function deleteCannedResponseAction(id: string, orgId: string) {
  await requireInternalRole();
  const existing = await getCannedResponseById(id, orgId);
  if (!existing) {
    throw new Error('Canned response not found');
  }

  await db
    .delete(cannedResponses)
    .where(and(eq(cannedResponses.id, id), eq(cannedResponses.orgId, orgId)));

  revalidatePath('/app');
  return { success: true };
}

