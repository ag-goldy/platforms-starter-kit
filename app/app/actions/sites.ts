'use server';

import { db } from '@/db';
import { areas, sites } from '@/db/schema';
import { requireInternalRole } from '@/lib/auth/permissions';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { slugify } from '@/lib/utils/slug';

const siteSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().optional(),
  address: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

const areaSchema = z.object({
  name: z.string().min(1).max(200),
  floor: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function getSitesAction(orgId: string, includeInactive = true) {
  await requireInternalRole();
  return db.query.sites.findMany({
    where: includeInactive
      ? eq(sites.orgId, orgId)
      : and(eq(sites.orgId, orgId), eq(sites.isActive, true)),
    orderBy: (table, { asc }) => [asc(table.name)],
  });
}

export async function createSiteAction(orgId: string, data: z.input<typeof siteSchema>) {
  await requireInternalRole();
  const validated = siteSchema.parse(data);
  const slug = slugify(validated.slug || validated.name);

  if (!slug) {
    throw new Error('Slug is required');
  }

  const [created] = await db
    .insert(sites)
    .values({
      orgId,
      name: validated.name,
      slug,
      address: validated.address || null,
      timezone: validated.timezone || null,
      notes: validated.notes || null,
      isActive: validated.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  revalidatePath(`/app/organizations/${orgId}/sites`);
  return { site: created };
}

export async function updateSiteAction(
  orgId: string,
  siteId: string,
  data: z.input<typeof siteSchema>
) {
  await requireInternalRole();
  const validated = siteSchema.parse(data);
  const slug = slugify(validated.slug || validated.name);

  if (!slug) {
    throw new Error('Slug is required');
  }

  const [updated] = await db
    .update(sites)
    .set({
      name: validated.name,
      slug,
      address: validated.address || null,
      timezone: validated.timezone || null,
      notes: validated.notes || null,
      isActive: validated.isActive ?? true,
      updatedAt: new Date(),
    })
    .where(and(eq(sites.id, siteId), eq(sites.orgId, orgId)))
    .returning();

  if (!updated) {
    throw new Error('Site not found');
  }

  revalidatePath(`/app/organizations/${orgId}/sites`);
  return { site: updated };
}

export async function toggleSiteActiveAction(orgId: string, siteId: string, isActive: boolean) {
  await requireInternalRole();
  const [updated] = await db
    .update(sites)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(sites.id, siteId), eq(sites.orgId, orgId)))
    .returning();

  if (!updated) {
    throw new Error('Site not found');
  }

  revalidatePath(`/app/organizations/${orgId}/sites`);
  return { site: updated };
}

export async function getAreasAction(orgId: string, siteId: string, includeInactive = true) {
  await requireInternalRole();
  const site = await db.query.sites.findFirst({
    where: and(eq(sites.id, siteId), eq(sites.orgId, orgId)),
  });

  if (!site) {
    throw new Error('Site not found');
  }

  return db.query.areas.findMany({
    where: includeInactive
      ? eq(areas.siteId, siteId)
      : and(eq(areas.siteId, siteId), eq(areas.isActive, true)),
    orderBy: (table, { asc }) => [asc(table.name)],
  });
}

export async function createAreaAction(
  orgId: string,
  siteId: string,
  data: z.input<typeof areaSchema>
) {
  await requireInternalRole();
  const validated = areaSchema.parse(data);

  const site = await db.query.sites.findFirst({
    where: and(eq(sites.id, siteId), eq(sites.orgId, orgId)),
  });

  if (!site) {
    throw new Error('Site not found');
  }

  const [created] = await db
    .insert(areas)
    .values({
      siteId,
      name: validated.name,
      floor: validated.floor || null,
      notes: validated.notes || null,
      isActive: validated.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  revalidatePath(`/app/organizations/${orgId}/sites`);
  return { area: created };
}

export async function updateAreaAction(
  orgId: string,
  areaId: string,
  data: z.input<typeof areaSchema>
) {
  await requireInternalRole();
  const validated = areaSchema.parse(data);

  const area = await db.query.areas.findFirst({
    where: eq(areas.id, areaId),
    with: { site: true },
  });

  if (!area || !area.site || area.site.orgId !== orgId) {
    throw new Error('Area not found');
  }

  const [updated] = await db
    .update(areas)
    .set({
      name: validated.name,
      floor: validated.floor || null,
      notes: validated.notes || null,
      isActive: validated.isActive ?? true,
      updatedAt: new Date(),
    })
    .where(eq(areas.id, areaId))
    .returning();

  revalidatePath(`/app/organizations/${orgId}/sites`);
  return { area: updated };
}

export async function toggleAreaActiveAction(orgId: string, areaId: string, isActive: boolean) {
  await requireInternalRole();

  const area = await db.query.areas.findFirst({
    where: eq(areas.id, areaId),
    with: { site: true },
  });

  if (!area || !area.site || area.site.orgId !== orgId) {
    throw new Error('Area not found');
  }

  const [updated] = await db
    .update(areas)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(areas.id, areaId))
    .returning();

  revalidatePath(`/app/organizations/${orgId}/sites`);
  return { area: updated };
}
