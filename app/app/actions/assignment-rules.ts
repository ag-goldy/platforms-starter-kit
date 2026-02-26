'use server';

import { db } from '@/db';
import { ticketAssignmentRules, users, internalGroups } from '@/db/schema';
import { requireInternalAdmin } from '@/lib/auth/permissions';
import { and, eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const conditionsSchema = z.object({
  requestTypeIds: z.array(z.string().uuid()).optional(),
  category: z.array(z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE_REQUEST'])).optional(),
  priority: z.array(z.enum(['P1', 'P2', 'P3', 'P4'])).optional(),
  siteId: z.string().uuid().optional(),
  keywords: z.array(z.string()).optional(),
});

const assignmentRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(0),
  conditions: conditionsSchema,
  strategy: z.enum(['specific_user', 'round_robin', 'load_balance', 'group']),
  assigneeId: z.string().uuid().optional(),
  internalGroupId: z.string().uuid().optional(),
});

export type AssignmentRuleInput = z.infer<typeof assignmentRuleSchema>;

export async function getAssignmentRules(orgId: string) {
  await requireInternalAdmin();

  const rules = await db.query.ticketAssignmentRules.findMany({
    where: eq(ticketAssignmentRules.orgId, orgId),
    orderBy: [desc(ticketAssignmentRules.priority), desc(ticketAssignmentRules.createdAt)],
    with: {
      assignee: {
        columns: { id: true, name: true, email: true },
      },
      internalGroup: {
        columns: { id: true, name: true },
      },
    },
  });

  return rules;
}

export async function createAssignmentRule(
  orgId: string,
  data: AssignmentRuleInput
) {
  await requireInternalAdmin();
  const validated = assignmentRuleSchema.parse(data);

  const [rule] = await db
    .insert(ticketAssignmentRules)
    .values({
      orgId,
      name: validated.name,
      description: validated.description || null,
      isActive: validated.isActive,
      priority: validated.priority,
      conditions: validated.conditions,
      strategy: validated.strategy,
      assigneeId: validated.assigneeId || null,
      internalGroupId: validated.internalGroupId || null,
    })
    .returning();

  revalidatePath(`/app/organizations/${orgId}/settings/assignment-rules`);
  return { rule };
}

export async function updateAssignmentRule(
  orgId: string,
  ruleId: string,
  data: AssignmentRuleInput
) {
  await requireInternalAdmin();
  const validated = assignmentRuleSchema.parse(data);

  const [rule] = await db
    .update(ticketAssignmentRules)
    .set({
      name: validated.name,
      description: validated.description || null,
      isActive: validated.isActive,
      priority: validated.priority,
      conditions: validated.conditions,
      strategy: validated.strategy,
      assigneeId: validated.assigneeId || null,
      internalGroupId: validated.internalGroupId || null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(ticketAssignmentRules.id, ruleId),
      eq(ticketAssignmentRules.orgId, orgId)
    ))
    .returning();

  if (!rule) {
    throw new Error('Rule not found');
  }

  revalidatePath(`/app/organizations/${orgId}/settings/assignment-rules`);
  return { rule };
}

export async function deleteAssignmentRule(orgId: string, ruleId: string) {
  await requireInternalAdmin();

  const [rule] = await db
    .delete(ticketAssignmentRules)
    .where(and(
      eq(ticketAssignmentRules.id, ruleId),
      eq(ticketAssignmentRules.orgId, orgId)
    ))
    .returning();

  if (!rule) {
    throw new Error('Rule not found');
  }

  revalidatePath(`/app/organizations/${orgId}/settings/assignment-rules`);
  return { success: true };
}

export async function toggleAssignmentRule(
  orgId: string,
  ruleId: string,
  isActive: boolean
) {
  await requireInternalAdmin();

  const [rule] = await db
    .update(ticketAssignmentRules)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(and(
      eq(ticketAssignmentRules.id, ruleId),
      eq(ticketAssignmentRules.orgId, orgId)
    ))
    .returning();

  if (!rule) {
    throw new Error('Rule not found');
  }

  revalidatePath(`/app/organizations/${orgId}/settings/assignment-rules`);
  return { rule };
}

export async function getAssignableUsers(orgId: string) {
  await requireInternalAdmin();

  const internalUsers = await db.query.users.findMany({
    where: eq(users.isInternal, true),
    columns: { id: true, name: true, email: true },
    orderBy: [users.name],
  });

  const groups = await db.query.internalGroups.findMany({
    where: eq(internalGroups.scope, 'PLATFORM'),
    columns: { id: true, name: true },
    orderBy: [internalGroups.name],
  });

  return { users: internalUsers, groups };
}
