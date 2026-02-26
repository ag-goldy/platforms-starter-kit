'use server';

import { db } from '@/db';
import { orgAIConfigs, orgAIMemory } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireOrgRole } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';

/**
 * Get AI configuration for an organization
 */
export async function getOrgAIConfigAction(orgId: string) {
  await requireOrgRole(orgId, ['ADMIN', 'CUSTOMER_ADMIN']);

  let config = await db.query.orgAIConfigs.findFirst({
    where: eq(orgAIConfigs.orgId, orgId),
  });

  // Create default config if doesn't exist
  if (!config) {
    const [newConfig] = await db.insert(orgAIConfigs).values({
      orgId,
      aiEnabled: true,
      customerAIEnabled: true,
      allowKBAccess: true,
      allowTicketSummaries: false,
      allowAssetInfo: false,
      allowServiceStatus: true,
      blockPIIInResponses: true,
      maxResponseTokens: 1000,
      customerRateLimit: 50,
      systemInstructions: '',
    }).returning();
    config = newConfig;
  }

  return config;
}

/**
 * Update AI configuration for an organization
 */
export async function updateOrgAIConfigAction(
  orgId: string,
  data: {
    aiEnabled?: boolean;
    customerAIEnabled?: boolean;
    allowKBAccess?: boolean;
    allowTicketSummaries?: boolean;
    allowAssetInfo?: boolean;
    allowServiceStatus?: boolean;
    blockPIIInResponses?: boolean;
    maxResponseTokens?: number;
    customerRateLimit?: number;
    systemInstructions?: string;
  }
) {
  await requireOrgRole(orgId, ['ADMIN', 'CUSTOMER_ADMIN']);

  await db.insert(orgAIConfigs)
    .values({ orgId, ...data })
    .onConflictDoUpdate({
      target: orgAIConfigs.orgId,
      set: { ...data, updatedAt: new Date() },
    });

  revalidatePath(`/app/organizations/${orgId}/ai-settings`);
  return { success: true };
}

/**
 * Get AI memories for an organization
 */
export async function getOrgAIMemoriesAction(orgId: string) {
  await requireOrgRole(orgId, ['ADMIN', 'CUSTOMER_ADMIN']);

  const memories = await db.query.orgAIMemory.findMany({
    where: eq(orgAIMemory.orgId, orgId),
    orderBy: [desc(orgAIMemory.priority), desc(orgAIMemory.createdAt)],
  });

  return memories;
}

/**
 * Add AI memory for an organization
 */
export async function addOrgAIMemoryAction(
  orgId: string,
  data: {
    memoryType: 'instruction' | 'fact' | 'preference' | 'policy';
    content: string;
    priority?: number;
  }
) {
  const session = await requireOrgRole(orgId, ['ADMIN', 'CUSTOMER_ADMIN']);

  const [memory] = await db.insert(orgAIMemory).values({
    orgId,
    memoryType: data.memoryType,
    content: data.content,
    priority: data.priority || 0,
    addedBy: session.user.id,
    isActive: true,
  }).returning();

  revalidatePath(`/app/organizations/${orgId}/ai-settings`);
  return memory;
}

/**
 * Update AI memory
 */
export async function updateOrgAIMemoryAction(
  orgId: string,
  memoryId: string,
  data: {
    content?: string;
    priority?: number;
    isActive?: boolean;
  }
) {
  await requireOrgRole(orgId, ['ADMIN', 'CUSTOMER_ADMIN']);

  await db.update(orgAIMemory)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(orgAIMemory.id, memoryId), eq(orgAIMemory.orgId, orgId)));

  revalidatePath(`/app/organizations/${orgId}/ai-settings`);
  return { success: true };
}

/**
 * Delete AI memory
 */
export async function deleteOrgAIMemoryAction(orgId: string, memoryId: string) {
  await requireOrgRole(orgId, ['ADMIN', 'CUSTOMER_ADMIN']);

  await db.delete(orgAIMemory)
    .where(and(eq(orgAIMemory.id, memoryId), eq(orgAIMemory.orgId, orgId)));

  revalidatePath(`/app/organizations/${orgId}/ai-settings`);
  return { success: true };
}
