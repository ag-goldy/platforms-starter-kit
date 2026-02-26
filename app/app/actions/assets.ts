'use server';

import { db } from '@/db';
import { areas, assets, sites } from '@/db/schema';
import { requireInternalRole } from '@/lib/auth/permissions';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const assetSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(50), // Can be standard or custom type
  status: z.string().min(1).max(50).default('ACTIVE'), // Can be standard or custom status
  siteId: z.string().uuid().optional().nullable(),
  areaId: z.string().uuid().optional().nullable(),
  hostname: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  macAddress: z.string().optional().nullable(),
  accessUrls: z.string().optional().nullable(), // JSON string of {label, url}[]
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

function parseAccessUrls(input?: string | null): { label: string; url: string }[] | null {
  if (!input) return null;
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      return parsed.filter(item => item.label && item.url);
    }
  } catch {
    // If not valid JSON, try comma-separated format: "Label:URL,Label2:URL2"
    const urls = input
      .split(',')
      .map((pair) => {
        const [label, ...urlParts] = pair.split(':');
        const url = urlParts.join(':'); // Handle URLs with colons
        if (label && url) {
          return { label: label.trim(), url: url.trim() };
        }
        return null;
      })
      .filter((item): item is { label: string; url: string } => item !== null);
    return urls.length > 0 ? urls : null;
  }
  return null;
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
    const site = area?.site as { orgId: string } | undefined;
    if (!area || !site || site.orgId !== orgId) {
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
      accessUrls: parseAccessUrls(validated.accessUrls),
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
      accessUrls: parseAccessUrls(validated.accessUrls),
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
