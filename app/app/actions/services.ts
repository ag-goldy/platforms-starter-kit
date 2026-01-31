'use server';

import { db } from '@/db';
import { organizations, services } from '@/db/schema';
import { requireInternalRole } from '@/lib/auth/permissions';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getOrgServicesAction(orgId: string) {
  await requireInternalRole();
  return db.query.services.findMany({
    where: eq(services.orgId, orgId),
    orderBy: (table, { asc }) => [asc(table.name)],
  });
}

export async function createServiceAction(data: {
  orgId: string;
  name: string;
  slug: string;
  description?: string | null;
  isUnderContract?: boolean;
}) {
  await requireInternalRole();
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, data.orgId),
    columns: { id: true },
  });
  if (!org) {
    return { error: 'Organization not found' };
  }
  const [service] = await db
    .insert(services)
    .values({
      orgId: data.orgId,
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      isUnderContract: !!data.isUnderContract,
    })
    .returning();
  revalidatePath(`/app/organizations/${data.orgId}/services`, 'page');
  return { service };
}

export async function updateServiceAction(serviceId: string, data: {
  name?: string;
  slug?: string;
  description?: string | null;
  status?: 'ACTIVE' | 'DEGRADED' | 'OFFLINE';
  isUnderContract?: boolean;
  businessHours?: unknown;
  slaResponseHoursP1?: number | null;
  slaResponseHoursP2?: number | null;
  slaResponseHoursP3?: number | null;
  slaResponseHoursP4?: number | null;
  slaResolutionHoursP1?: number | null;
  slaResolutionHoursP2?: number | null;
  slaResolutionHoursP3?: number | null;
  slaResolutionHoursP4?: number | null;
}) {
  await requireInternalRole();
  await db
    .update(services)
    .set({
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      status: data.status,
      isUnderContract: data.isUnderContract,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      businessHours: data.businessHours as any,
      slaResponseHoursP1: data.slaResponseHoursP1 ?? null,
      slaResponseHoursP2: data.slaResponseHoursP2 ?? null,
      slaResponseHoursP3: data.slaResponseHoursP3 ?? null,
      slaResponseHoursP4: data.slaResponseHoursP4 ?? null,
      slaResolutionHoursP1: data.slaResolutionHoursP1 ?? null,
      slaResolutionHoursP2: data.slaResolutionHoursP2 ?? null,
      slaResolutionHoursP3: data.slaResolutionHoursP3 ?? null,
      slaResolutionHoursP4: data.slaResolutionHoursP4 ?? null,
      updatedAt: new Date(),
    })
    .where(eq(services.id, serviceId));
  return { success: true };
}

export async function deleteServiceAction(serviceId: string, orgId: string) {
  await requireInternalRole();
  await db.delete(services).where(and(eq(services.id, serviceId), eq(services.orgId, orgId)));
  revalidatePath(`/app/organizations/${orgId}/services`, 'page');
  return { success: true };
}

