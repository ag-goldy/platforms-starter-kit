'use server';

import { db } from '@/db';
import { escalationRules } from '@/db/schema';
import { requireInternalAdmin } from '@/lib/auth/permissions';
import { and, eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const actionsSchema = z.object({
  notifyUserIds: z.array(z.string().uuid()).optional(),
  notifyGroupIds: z.array(z.string().uuid()).optional(),
  changePriority: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),
  addTags: z.array(z.string()).optional(),
  assignToUserId: z.string().uuid().optional(),
  addComment: z.string().optional(),
});

const escalationRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  triggerType: z.enum(['no_response', 'no_resolution', 'sla_warning', 'sla_breach']),
  timeThreshold: z.number().int().min(1).max(10080), // Max 1 week in minutes
  applicablePriorities: z.array(z.enum(['P1', 'P2', 'P3', 'P4'])).default(['P1', 'P2', 'P3', 'P4']),
  applicableCategories: z.array(z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE_REQUEST'])).default(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE_REQUEST']),
  actions: actionsSchema,
});

export type EscalationRuleInput = z.infer<typeof escalationRuleSchema>;

export async function getEscalationRules(orgId: string) {
  await requireInternalAdmin();

  const rules = await db.query.escalationRules.findMany({
    where: eq(escalationRules.orgId, orgId),
    orderBy: [desc(escalationRules.createdAt)],
  });

  return rules;
}

export async function createEscalationRule(
  orgId: string,
  data: EscalationRuleInput
) {
  await requireInternalAdmin();
  const validated = escalationRuleSchema.parse(data);

  const [rule] = await db
    .insert(escalationRules)
    .values({
      orgId,
      name: validated.name,
      description: validated.description || null,
      isActive: validated.isActive,
      triggerType: validated.triggerType,
      timeThreshold: validated.timeThreshold,
      applicablePriorities: validated.applicablePriorities,
      applicableCategories: validated.applicableCategories,
      actions: validated.actions,
    })
    .returning();

  revalidatePath(`/app/organizations/${orgId}/settings/escalation-rules`);
  return { rule };
}

export async function updateEscalationRule(
  orgId: string,
  ruleId: string,
  data: EscalationRuleInput
) {
  await requireInternalAdmin();
  const validated = escalationRuleSchema.parse(data);

  const [rule] = await db
    .update(escalationRules)
    .set({
      name: validated.name,
      description: validated.description || null,
      isActive: validated.isActive,
      triggerType: validated.triggerType,
      timeThreshold: validated.timeThreshold,
      applicablePriorities: validated.applicablePriorities,
      applicableCategories: validated.applicableCategories,
      actions: validated.actions,
      updatedAt: new Date(),
    })
    .where(and(
      eq(escalationRules.id, ruleId),
      eq(escalationRules.orgId, orgId)
    ))
    .returning();

  if (!rule) {
    throw new Error('Rule not found');
  }

  revalidatePath(`/app/organizations/${orgId}/settings/escalation-rules`);
  return { rule };
}

export async function deleteEscalationRule(orgId: string, ruleId: string) {
  await requireInternalAdmin();

  const [rule] = await db
    .delete(escalationRules)
    .where(and(
      eq(escalationRules.id, ruleId),
      eq(escalationRules.orgId, orgId)
    ))
    .returning();

  if (!rule) {
    throw new Error('Rule not found');
  }

  revalidatePath(`/app/organizations/${orgId}/settings/escalation-rules`);
  return { success: true };
}

export async function toggleEscalationRule(
  orgId: string,
  ruleId: string,
  isActive: boolean
) {
  await requireInternalAdmin();

  const [rule] = await db
    .update(escalationRules)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(and(
      eq(escalationRules.id, ruleId),
      eq(escalationRules.orgId, orgId)
    ))
    .returning();

  if (!rule) {
    throw new Error('Rule not found');
  }

  revalidatePath(`/app/organizations/${orgId}/settings/escalation-rules`);
  return { rule };
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  const days = Math.floor(minutes / 1440);
  return `${days} day${days > 1 ? 's' : ''}`;
}
