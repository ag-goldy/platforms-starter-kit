'use server';

import { db } from '@/db';
import { organizations, users, memberships } from '@/db/schema';
import { requireInternalRole } from '@/lib/auth/permissions';
import { logAudit } from '@/lib/audit/log';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';

export async function createOrganizationAction(data: {
  name: string;
  slug: string;
  subdomain: string;
}) {
  const user = await requireInternalRole();

  // Validate slug and subdomain format
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(data.slug) || !slugRegex.test(data.subdomain)) {
    throw new Error('Slug and subdomain must be lowercase alphanumeric with hyphens only');
  }

  const [org] = await db
    .insert(organizations)
    .values({
      name: data.name,
      slug: data.slug,
      subdomain: data.subdomain,
    })
    .returning();

  await logAudit({
    userId: user.id,
    orgId: org.id,
    action: 'ORG_CREATED',
    details: JSON.stringify({ name: org.name, slug: org.slug }),
  });

  // Create default automation rules for the new organization
  try {
    const { createDefaultRules } = await import('@/lib/automation/default-rules');
    await createDefaultRules(org.id);
  } catch (error) {
    console.error('Failed to create default automation rules:', error);
    // Don't fail organization creation if default rules fail
  }

  revalidatePath('/app/organizations');
  return { orgId: org.id };
}

export async function updateOrg2FAPolicyAction(orgId: string, requireTwoFactor: boolean) {
  const user = await requireInternalRole();

  await db
    .update(organizations)
    .set({
      requireTwoFactor,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  await logAudit({
    userId: user.id,
    orgId,
    action: 'ORG_UPDATED',
    details: JSON.stringify({ requireTwoFactor }),
  });

  revalidatePath(`/app/organizations/${orgId}`);
  return { success: true, error: null };
}

export async function inviteUserAction(data: {
  orgId: string;
  email: string;
  name?: string;
  role: 'CUSTOMER_ADMIN' | 'REQUESTER' | 'VIEWER';
}) {
  const user = await requireInternalRole();

  // Find or create user
  let targetUser = await db.query.users.findFirst({
    where: eq(users.email, data.email),
  });

  if (!targetUser) {
    [targetUser] = await db
      .insert(users)
      .values({
        email: data.email,
        name: data.name,
        isInternal: false,
      })
      .returning();
  }

  // Check if membership already exists
  const existingMembership = await db.query.memberships.findFirst({
    where: (memberships, { eq, and }) =>
      and(
        eq(memberships.userId, targetUser.id),
        eq(memberships.orgId, data.orgId)
      ),
  });

  if (existingMembership) {
    throw new Error('User is already a member of this organization');
  }

  // Create membership
  await db.insert(memberships).values({
    userId: targetUser.id,
    orgId: data.orgId,
    role: data.role,
  });

  await logAudit({
    userId: user.id,
    orgId: data.orgId,
    action: 'USER_INVITED',
    details: JSON.stringify({ email: data.email, role: data.role }),
  });

  revalidatePath(`/app/organizations/${data.orgId}`);
}

export async function updateUserRoleAction(data: {
  orgId: string;
  userId: string;
  role: 'CUSTOMER_ADMIN' | 'REQUESTER' | 'VIEWER';
}) {
  const user = await requireInternalRole();

  await db
    .update(memberships)
    .set({ role: data.role })
    .where(
      and(
        eq(memberships.userId, data.userId),
        eq(memberships.orgId, data.orgId)
      )
    );

  await logAudit({
    userId: user.id,
    orgId: data.orgId,
    action: 'USER_ROLE_CHANGED',
    details: JSON.stringify({ targetUserId: data.userId, role: data.role }),
  });

  revalidatePath(`/app/organizations/${data.orgId}`);
}

