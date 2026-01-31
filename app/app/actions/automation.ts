'use server';

import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { automationRules } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Condition, Action, TriggerOn } from '@/lib/automation/types';

const automationRuleSchema = z.object({
  name: z.string().min(1).max(200),
  enabled: z.boolean(),
  priority: z.number().int().min(0),
  triggerOn: z.enum([
    'TICKET_CREATED',
    'TICKET_UPDATED',
    'COMMENT_ADDED',
    'STATUS_CHANGED',
    'PRIORITY_CHANGED',
    'ASSIGNED',
    'UNASSIGNED'
  ]),
  conditions: z.array(z.any()), // Validate conditions structure
  actions: z.array(z.any()), // Validate actions structure
});

/**
 * Get all automation rules for an organization
 */
export async function getAutomationRulesAction(orgId: string) {
  await requireInternalRole();
  const rules = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.orgId, orgId))
    .orderBy(desc(automationRules.priority));

  return rules.map((rule) => ({
    ...rule,
    triggerOn: rule.triggerOn as TriggerOn,
    conditions: rule.conditions as unknown as Condition[],
    actions: rule.actions as unknown as Action[],
  }));
}

/**
 * Create a new automation rule
 */
export async function createAutomationRuleAction(
  orgId: string,
  data: {
    name: string;
    enabled: boolean;
    priority: number;
    triggerOn: TriggerOn;
    conditions: Condition[];
    actions: Action[];
  }
) {
  const user = await requireInternalRole();
  const validated = automationRuleSchema.parse(data);

  const [rule] = await db
    .insert(automationRules)
    .values({
      orgId,
      name: validated.name,
      enabled: validated.enabled,
      priority: validated.priority,
      triggerOn: validated.triggerOn,
      conditions: validated.conditions,
      actions: validated.actions,
      createdBy: user.id,
    })
    .returning();

  revalidatePath('/app');
  revalidatePath(`/app/organizations/${orgId}/automation`);
  return rule;
}

/**
 * Update an automation rule
 */
export async function updateAutomationRuleAction(
  id: string,
  orgId: string,
  data: Partial<{
    name: string;
    enabled: boolean;
    priority: number;
    triggerOn: TriggerOn;
    conditions: Condition[];
    actions: Action[];
  }>
) {
  await requireInternalRole();

  const updateData: Partial<typeof automationRules.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.triggerOn !== undefined) updateData.triggerOn = data.triggerOn;
  if (data.conditions !== undefined) updateData.conditions = data.conditions;
  if (data.actions !== undefined) updateData.actions = data.actions;

  const [updated] = await db
    .update(automationRules)
    .set(updateData)
    .where(and(eq(automationRules.id, id), eq(automationRules.orgId, orgId)))
    .returning();

  revalidatePath('/app');
  revalidatePath(`/app/organizations/${orgId}/automation`);
  return updated;
}

/**
 * Delete an automation rule
 */
export async function deleteAutomationRuleAction(id: string, orgId: string) {
  await requireInternalRole();

  await db
    .delete(automationRules)
    .where(and(eq(automationRules.id, id), eq(automationRules.orgId, orgId)));

  revalidatePath('/app');
  revalidatePath(`/app/organizations/${orgId}/automation`);
  return { success: true };
}
