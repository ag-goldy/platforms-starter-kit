'use server';

import { db } from '@/db';
import { internalGroups, internalGroupMemberships, organizations, users } from '@/db/schema';
import { requireInternalAdmin } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

const groupNameSchema = z.string().trim().min(2).max(80);
const descriptionSchema = z.string().trim().max(300);
const roleSchema = z.enum(['ADMIN', 'MEMBER']);
const scopeSchema = z.enum(['PLATFORM', 'ORG']);
const platformRoleTypes = [
  'PLATFORM_SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'SECURITY_ADMIN',
  'COMPLIANCE_AUDITOR',
  'BILLING_ADMIN',
  'INTEGRATION_ADMIN',
] as const;
const orgRoleTypes = [
  'ORG_ADMIN',
  'SUPPORT_OPS_ADMIN',
  'TEAM_QUEUE_MANAGER',
  'SUPERVISOR',
  'AGENT',
] as const;
type PlatformRoleType = (typeof platformRoleTypes)[number];
type OrgRoleType = (typeof orgRoleTypes)[number];
const roleTypeValues = [...platformRoleTypes, ...orgRoleTypes] as const;
type RoleType = (typeof roleTypeValues)[number];
const roleTypeSchema = z.enum(roleTypeValues);
const idSchema = z.string().uuid();
const platformRoleTypeSet = new Set<RoleType>(platformRoleTypes);
const orgRoleTypeSet = new Set<RoleType>(orgRoleTypes);

const isPlatformRoleType = (value: RoleType): value is PlatformRoleType =>
  platformRoleTypeSet.has(value);
const isOrgRoleType = (value: RoleType): value is OrgRoleType => orgRoleTypeSet.has(value);

async function countGroupAdmins(groupId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(internalGroupMemberships)
    .where(
      and(
        eq(internalGroupMemberships.groupId, groupId),
        eq(internalGroupMemberships.role, 'ADMIN')
      )
    );
  return Number(result?.count ?? 0);
}

export async function createInternalGroupAction(data: {
  name: string;
  description?: string | null;
  scope: 'PLATFORM' | 'ORG';
  roleType: RoleType;
  orgId?: string | null;
}) {
  const admin = await requireInternalAdmin();
  const name = groupNameSchema.parse(data.name);
  const description =
    data.description && data.description.trim()
      ? descriptionSchema.parse(data.description)
      : null;
  const scope = scopeSchema.parse(data.scope);
  const roleType = roleTypeSchema.parse(data.roleType);
  const orgId = data.orgId ? idSchema.parse(data.orgId) : null;

  if (scope === 'PLATFORM' && orgId) {
    throw new Error('Platform groups cannot be tied to an organization');
  }
  if (scope === 'ORG' && !orgId) {
    throw new Error('Organization is required for org-scoped groups');
  }
  if (scope === 'PLATFORM' && !isPlatformRoleType(roleType)) {
    throw new Error('Role type must be a platform role for platform groups');
  }
  if (scope === 'ORG' && !isOrgRoleType(roleType)) {
    throw new Error('Role type must be an org role for org-scoped groups');
  }

  if (orgId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });
    if (!org) {
      throw new Error('Organization not found');
    }
  }

  try {
    const [group] = await db
      .insert(internalGroups)
      .values({
        name,
        description,
        scope,
        roleType,
        orgId,
        createdBy: admin.id,
      })
      .returning();

    revalidatePath('/app/admin/internal-groups');
    return { group };
  } catch (error) {
    if (error instanceof Error && error.message.includes('unique')) {
      throw new Error('A group with this name already exists');
    }
    throw error;
  }
}

export async function deleteInternalGroupAction(groupId: string) {
  await requireInternalAdmin();
  const id = idSchema.parse(groupId);

  await db.delete(internalGroups).where(eq(internalGroups.id, id));
  revalidatePath('/app/admin/internal-groups');

  return { success: true };
}

export async function addInternalGroupMemberAction(data: {
  groupId: string;
  userId: string;
  role: 'ADMIN' | 'MEMBER';
}) {
  await requireInternalAdmin();
  const groupId = idSchema.parse(data.groupId);
  const userId = idSchema.parse(data.userId);
  const role = roleSchema.parse(data.role);

  const group = await db.query.internalGroups.findFirst({
    where: eq(internalGroups.id, groupId),
  });
  if (!group) {
    throw new Error('Group not found');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user || !user.isInternal) {
    throw new Error('User must be an internal user');
  }

  try {
    const [membership] = await db
      .insert(internalGroupMemberships)
      .values({ groupId, userId, role })
      .returning();

    revalidatePath('/app/admin/internal-groups');
    return {
      membership: {
        ...membership,
        user: { id: user.id, name: user.name, email: user.email },
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('unique')) {
      throw new Error('User is already in this group');
    }
    throw error;
  }
}

export async function updateInternalGroupMemberRoleAction(data: {
  membershipId: string;
  groupId: string;
  role: 'ADMIN' | 'MEMBER';
}) {
  await requireInternalAdmin();
  const membershipId = idSchema.parse(data.membershipId);
  const groupId = idSchema.parse(data.groupId);
  const role = roleSchema.parse(data.role);

  const membership = await db.query.internalGroupMemberships.findFirst({
    where: eq(internalGroupMemberships.id, membershipId),
  });
  if (!membership) {
    throw new Error('Membership not found');
  }
  if (membership.groupId !== groupId) {
    throw new Error('Membership does not belong to this group');
  }

  if (membership.role === 'ADMIN' && role !== 'ADMIN') {
    const adminCount = await countGroupAdmins(groupId);
    if (adminCount <= 1) {
      throw new Error('At least one admin must remain in the group');
    }
  }

  const [updated] = await db
    .update(internalGroupMemberships)
    .set({ role })
    .where(eq(internalGroupMemberships.id, membershipId))
    .returning();

  revalidatePath('/app/admin/internal-groups');
  return { membership: updated };
}

export async function removeInternalGroupMemberAction(data: {
  membershipId: string;
  groupId: string;
}) {
  await requireInternalAdmin();
  const membershipId = idSchema.parse(data.membershipId);
  const groupId = idSchema.parse(data.groupId);

  const membership = await db.query.internalGroupMemberships.findFirst({
    where: eq(internalGroupMemberships.id, membershipId),
  });
  if (!membership) {
    throw new Error('Membership not found');
  }
  if (membership.groupId !== groupId) {
    throw new Error('Membership does not belong to this group');
  }

  if (membership.role === 'ADMIN') {
    const adminCount = await countGroupAdmins(groupId);
    if (adminCount <= 1) {
      throw new Error('At least one admin must remain in the group');
    }
  }

  await db.delete(internalGroupMemberships).where(eq(internalGroupMemberships.id, membershipId));
  revalidatePath('/app/admin/internal-groups');
  return { success: true };
}
