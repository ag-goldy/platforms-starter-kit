'use server';

import { db } from '@/db';
import { organizations, users, memberships, tickets, kbArticles, kbCategories, assets, services, automationRules, escalationRules, auditLogs } from '@/db/schema';
import { requireInternalRole } from '@/lib/auth/permissions';
import { logAudit } from '@/lib/audit/log';
import { revalidatePath } from 'next/cache';
import { eq, and, asc } from 'drizzle-orm';
import { invalidateOrgSettings, invalidateOrgAll } from '@/lib/cache-invalidation';

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

  // Invalidate org settings cache
  await invalidateOrgSettings(orgId);
  
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

/**
 * Get all organizations (admin only)
 */
export async function getAllOrganizationsAction() {
  await requireInternalRole();

  const orgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
    })
    .from(organizations)
    .orderBy(asc(organizations.name));

  return orgs;
}

/**
 * Disable an organization (soft disable - reversible)
 */
export async function disableOrganizationAction(orgId: string): Promise<void> {
  const user = await requireInternalRole();

  // Check if org exists and is not already disabled
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  if (!org.isActive) {
    throw new Error('Organization is already disabled');
  }

  // Update organization
  await db
    .update(organizations)
    .set({
      isActive: false,
      disabledAt: new Date(),
      disabledBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  // Log audit
  await logAudit({
    userId: user.id,
    orgId,
    action: 'ORG_DISABLED',
    details: JSON.stringify({ name: org.name }),
  });

  // Invalidate cache
  await invalidateOrgSettings(orgId);
  await invalidateOrgAll(orgId);

  revalidatePath('/app/organizations');
  revalidatePath(`/app/organizations/${orgId}`);
}

/**
 * Enable a disabled organization
 */
export async function enableOrganizationAction(orgId: string): Promise<void> {
  const user = await requireInternalRole();

  // Check if org exists and is disabled
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  if (org.isActive) {
    throw new Error('Organization is already enabled');
  }

  // Update organization
  await db
    .update(organizations)
    .set({
      isActive: true,
      disabledAt: null,
      disabledBy: null,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  // Log audit
  await logAudit({
    userId: user.id,
    orgId,
    action: 'ORG_ENABLED',
    details: JSON.stringify({ name: org.name }),
  });

  // Invalidate cache
  await invalidateOrgSettings(orgId);
  await invalidateOrgAll(orgId);

  revalidatePath('/app/organizations');
  revalidatePath(`/app/organizations/${orgId}`);
}

/**
 * Permanently delete an organization and all its data
 * REQUIRES: Organization must already be disabled
 * Uses CASCADE deletes from the database schema
 */
export async function deleteOrganizationAction(
  orgId: string,
  confirmationName: string
): Promise<void> {
  const user = await requireInternalRole();

  // Get organization
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  // Verify confirmation name matches exactly
  if (confirmationName !== org.name) {
    throw new Error('Organization name does not match confirmation');
  }

  // Organization must be disabled before deletion
  if (org.isActive) {
    throw new Error('Organization must be disabled before it can be deleted');
  }

  // Log deletion BEFORE deleting (so we have the org reference)
  await logAudit({
    userId: user.id,
    orgId,
    action: 'ORG_DELETED',
    details: JSON.stringify({ 
      deletedOrgId: orgId, 
      deletedOrgName: org.name,
      deletedBy: user.id,
      deletedAt: new Date().toISOString(),
    }),
  });

  // Delete the organization - CASCADE will handle related records
  // Based on schema, these have onDelete: 'cascade' to organizations:
  // - services, assets, memberships, tickets, kbCategories, kbArticles, automationRules, escalationRules
  // auditLogs has onDelete: 'set null' so orgId will be nulled
  await db.delete(organizations).where(eq(organizations.id, orgId));

  // Invalidate all cache for this org
  await invalidateOrgAll(orgId);

  // Trigger blob storage cleanup (can be async)
  try {
    const { enqueueJob } = await import('@/lib/jobs/queue');
    await enqueueJob({
      type: 'CLEANUP_ORG_STORAGE',
      data: { orgId },
      maxAttempts: 3,
    });
  } catch (error) {
    console.error('Failed to enqueue storage cleanup:', error);
    // Don't fail deletion if cleanup job fails
  }

  revalidatePath('/app/organizations');
}
