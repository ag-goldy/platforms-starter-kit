'use server';

import { db } from '@/db';
import { areas, assets, sites } from '@/db/schema';
import { requireInternalRole } from '@/lib/auth/permissions';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const assetSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['AP', 'SWITCH', 'FIREWALL', 'CAMERA', 'NVR', 'SERVER', 'ISP_CIRCUIT', 'OTHER']),
  status: z.enum(['ACTIVE', 'RETIRED', 'MAINTENANCE']).default('ACTIVE'),
  siteId: z.string().uuid().optional().nullable(),
  areaId: z.string().uuid().optional().nullable(),
  hostname: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  macAddress: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function normalizeTags(input?: string | null): string[] | null {
  if (!input) return null;
  const tags = input
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : null;
}

async function validateSiteAndArea(orgId: string, siteId?: string | null, areaId?: string | null) {
  if (siteId) {
    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, siteId), eq(sites.orgId, orgId)),
    });
    if (!site) {
      throw new Error('Site not found');
    }
  }

  if (areaId) {
    const area = await db.query.areas.findFirst({
      where: eq(areas.id, areaId),
      with: { site: true },
    });
    if (!area || !area.site || area.site.orgId !== orgId) {
      throw new Error('Area not found');
    }
    if (siteId && area.siteId !== siteId) {
      throw new Error('Area does not belong to selected site');
    }
  }
}

export async function getAssetsAction(orgId: string) {
  await requireInternalRole();
  return db.query.assets.findMany({
    where: eq(assets.orgId, orgId),
    orderBy: (table, { asc }) => [asc(table.name)],
    with: {
      site: true,
      area: true,
    },
  });
}

export async function createAssetAction(orgId: string, data: z.input<typeof assetSchema>) {
  await requireInternalRole();
  const validated = assetSchema.parse(data);

  await validateSiteAndArea(orgId, validated.siteId || null, validated.areaId || null);

  const [created] = await db
    .insert(assets)
    .values({
      orgId,
      siteId: validated.siteId || null,
      areaId: validated.areaId || null,
      type: validated.type,
      name: validated.name,
      hostname: validated.hostname || null,
      serialNumber: validated.serialNumber || null,
      model: validated.model || null,
      vendor: validated.vendor || null,
      ipAddress: validated.ipAddress || null,
      macAddress: validated.macAddress || null,
      tags: normalizeTags(validated.tags),
      notes: validated.notes || null,
      status: validated.status,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  revalidatePath(`/app/organizations/${orgId}/assets`);
  return { asset: created };
}

export async function updateAssetAction(
  orgId: string,
  assetId: string,
  data: z.input<typeof assetSchema>
) {
  await requireInternalRole();
  const validated = assetSchema.parse(data);

  await validateSiteAndArea(orgId, validated.siteId || null, validated.areaId || null);

  const [updated] = await db
    .update(assets)
    .set({
      siteId: validated.siteId || null,
      areaId: validated.areaId || null,
      type: validated.type,
      name: validated.name,
      hostname: validated.hostname || null,
      serialNumber: validated.serialNumber || null,
      model: validated.model || null,
      vendor: validated.vendor || null,
      ipAddress: validated.ipAddress || null,
      macAddress: validated.macAddress || null,
      tags: normalizeTags(validated.tags),
      notes: validated.notes || null,
      status: validated.status,
      updatedAt: new Date(),
    })
    .where(and(eq(assets.id, assetId), eq(assets.orgId, orgId)))
    .returning();

  if (!updated) {
    throw new Error('Asset not found');
  }

  revalidatePath(`/app/organizations/${orgId}/assets`);
  return { asset: updated };
}
