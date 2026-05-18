'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { failedJobs, memberships, organizations, orgQuotas, userInvitations, users } from '@/db/schema';
import {
  clearImpersonationState,
  logPlatformAudit,
  requirePlatformAdmin,
  setImpersonationState,
} from '@/lib/admin/platform';
import { deleteFailedJob, retryFailedJob } from '@/lib/jobs/dead-letter';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function requireSlug(value: string) {
  const slug = value.toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug)) {
    throw new Error('Slug must be 3-63 lowercase letters, numbers, or hyphens');
  }
  return slug;
}

export async function createTenantAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const name = readString(formData, 'name');
  const slug = requireSlug(readString(formData, 'slug'));
  const ownerEmail = readString(formData, 'ownerEmail').toLowerCase();
  const plan = readString(formData, 'plan') || 'free';
  const platformRegion = readString(formData, 'region') || 'us';
  const retentionDays = Number(readString(formData, 'retentionDays')) || null;

  if (name.length < 2 || !ownerEmail.includes('@')) {
    throw new Error('Tenant name and owner email are required');
  }

  const [org] = await db.insert(organizations).values({
    name,
    slug,
    subdomain: slug,
    platformRegion,
    dataRetentionDays: retentionDays,
    retentionPolicy: retentionDays ? 'ANONYMIZE_AFTER_DAYS' : null,
    features: {
      assets: true,
      exports: true,
      team: true,
      services: true,
      knowledge: true,
      status_page: false,
      service_catalog: true,
    },
  }).returning();

  await db.insert(orgQuotas).values({
    orgId: org.id,
    plan,
  }).onConflictDoNothing();

  /* eslint-disable no-restricted-syntax -- Tenant creation resolves owner email globally before an org membership exists. */
  const existingOwner = await db.query.users.findFirst({
    where: eq(users.email, ownerEmail),
    columns: { id: true },
  });
  /* eslint-enable no-restricted-syntax */

  if (existingOwner) {
    await db.insert(memberships).values({
      orgId: org.id,
      userId: existingOwner.id,
      role: 'CUSTOMER_ADMIN',
    }).onConflictDoNothing();
  } else {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);
    await db.insert(userInvitations).values({
      orgId: org.id,
      email: ownerEmail,
      role: 'CUSTOMER_ADMIN',
      invitedByPlatformAdmin: admin.id,
      token,
      expiresAt,
    });
  }

  await logPlatformAudit({
    platformAdminId: admin.id,
    orgId: org.id,
    action: 'ORG_CREATED',
    details: { actor: admin.email, ownerEmail, plan, platformRegion },
  });

  revalidatePath('/admin');
  redirect(`/admin/tenants/${org.id}`);
}

export async function suspendTenantAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const orgId = readString(formData, 'orgId');
  const reason = readString(formData, 'reason') || 'Suspended by platform admin';

  await db.update(organizations)
    .set({
      isActive: false,
      disabledAt: new Date(),
      disabledBy: admin.id,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  await logPlatformAudit({
    platformAdminId: admin.id,
    orgId,
    action: 'ORG_DISABLED',
    details: { reason, actor: admin.email },
  });

  revalidatePath('/admin');
  revalidatePath(`/admin/tenants/${orgId}`);
}

export async function enableTenantAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const orgId = readString(formData, 'orgId');

  await db.update(organizations)
    .set({
      isActive: true,
      disabledAt: null,
      disabledBy: null,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  await logPlatformAudit({
    platformAdminId: admin.id,
    orgId,
    action: 'ORG_ENABLED',
    details: { actor: admin.email },
  });

  revalidatePath('/admin');
  revalidatePath(`/admin/tenants/${orgId}`);
}

export async function scheduleTenantDeleteAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const orgId = readString(formData, 'orgId');
  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() + 30);

  await db.update(organizations)
    .set({
      deletionScheduledAt: scheduledAt,
      deletionScheduledBy: admin.id,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  await logPlatformAudit({
    platformAdminId: admin.id,
    orgId,
    action: 'ORG_DELETED',
    details: { mode: 'scheduled', scheduledAt: scheduledAt.toISOString(), actor: admin.email },
  });

  revalidatePath('/admin');
  revalidatePath(`/admin/tenants/${orgId}`);
}

export async function updateTenantFeatureFlagsAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const orgId = readString(formData, 'orgId');
  const features = {
    assets: formData.get('assets') === 'on',
    exports: formData.get('exports') === 'on',
    team: formData.get('team') === 'on',
    services: formData.get('services') === 'on',
    knowledge: formData.get('knowledge') === 'on',
    status_page: formData.get('status_page') === 'on',
    service_catalog: formData.get('service_catalog') === 'on',
  };

  await db.update(organizations)
    .set({ features, updatedAt: new Date() })
    .where(eq(organizations.id, orgId));

  await logPlatformAudit({
    platformAdminId: admin.id,
    orgId,
    action: 'ORG_UPDATED',
    details: { featureFlags: features, actor: admin.email },
  });

  revalidatePath('/admin/feature-flags');
  revalidatePath(`/admin/tenants/${orgId}`);
}

export async function startImpersonationAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const orgId = readString(formData, 'orgId');
  const userId = readString(formData, 'userId');
  const reason = readString(formData, 'reason') || 'Platform support';
  const requestedDuration = Number(readString(formData, 'durationMinutes')) || 30;
  const durationMinutes = Math.min(Math.max(requestedDuration, 15), 60);

  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.orgId, orgId),
      eq(memberships.userId, userId),
      eq(memberships.isActive, true)
    ),
  });

  if (!membership) {
    throw new Error('Selected user is not an active tenant member');
  }

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

  await setImpersonationState({
    platformAdminId: admin.id,
    orgId,
    userId,
    startedAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    reason,
  }, durationMinutes);

  await logPlatformAudit({
    platformAdminId: admin.id,
    orgId,
    action: 'ORG_UPDATED',
    details: {
      event: 'IMPERSONATION_STARTED',
      impersonatedUserId: userId,
      reason,
      durationMinutes,
      expiresAt: expiresAt.toISOString(),
      actor: admin.email,
    },
  });

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { slug: true },
  });

  redirect(`/${org?.slug || orgId}/portal`);
}

export async function stopImpersonationAction() {
  const admin = await requirePlatformAdmin();
  await clearImpersonationState();
  await logPlatformAudit({
    platformAdminId: admin.id,
    action: 'ORG_UPDATED',
    details: { event: 'IMPERSONATION_ENDED', actor: admin.email },
  });
  redirect('/admin');
}

export async function retryAdminFailedJobAction(formData: FormData) {
  await requirePlatformAdmin();
  const id = readString(formData, 'id');
  await retryFailedJob(id);
  revalidatePath('/admin/jobs');
}

export async function discardAdminFailedJobAction(formData: FormData) {
  await requirePlatformAdmin();
  const id = readString(formData, 'id');
  await deleteFailedJob(id);
  revalidatePath('/admin/jobs');
}

export async function listTenantUsers(orgId: string) {
  await requirePlatformAdmin();
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
      isActive: memberships.isActive,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.orgId, orgId))
    .limit(100);
}

export async function countOpenFailedJobs() {
  await requirePlatformAdmin();
  return db.select({ id: failedJobs.id }).from(failedJobs).limit(1000);
}
