'use server';

import { db } from '@/db';
import { areas, assets, sites } from '@/db/schema';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
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

// Custom asset type schema
const orgAssetTypeSchema = z.object({
  name: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  color: z.string().max(7).default('#6B7280'),
  icon: z.string().optional().nullable(),
  sortOrder: z.number().default(0),
});

// Custom asset status schema
const orgAssetStatusSchema = z.object({
  name: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  color: z.string().max(7).default('#6B7280'),
  sortOrder: z.number().default(0),
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

export async function getCustomerAssetsAction(orgId: string) {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);
  return db.query.assets.findMany({
    where: eq(assets.orgId, orgId),
    orderBy: (table, { asc }) => [asc(table.name)],
    with: {
      site: true,
      area: true,
    },
  });
}

export async function createCustomerAssetAction(orgId: string, data: z.input<typeof assetSchema>) {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);
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

  revalidatePath(`/s/[subdomain]/assets`);
  return { asset: created };
}

export async function updateCustomerAssetAction(
  orgId: string,
  assetId: string,
  data: z.input<typeof assetSchema>
) {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);
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

  revalidatePath(`/s/[subdomain]/assets`);
  return { asset: updated };
}

// ============================================================================
// CUSTOM ASSET TYPES
// ============================================================================

import { orgAssetTypes, orgAssetStatuses, type OrgAssetType, type OrgAssetStatus } from '@/db/schema';
import { desc, asc } from 'drizzle-orm';

export async function getOrgAssetTypesAction(orgId: string): Promise<OrgAssetType[]> {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);
  return db.query.orgAssetTypes.findMany({
    where: eq(orgAssetTypes.orgId, orgId),
    orderBy: [asc(orgAssetTypes.sortOrder), asc(orgAssetTypes.label)],
  });
}

export async function createOrgAssetTypeAction(
  orgId: string,
  data: z.input<typeof orgAssetTypeSchema>
) {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);
  const validated = orgAssetTypeSchema.parse(data);

  const [created] = await db
    .insert(orgAssetTypes)
    .values({
      orgId,
      name: validated.name,
      label: validated.label,
      description: validated.description || null,
      color: validated.color,
      icon: validated.icon || null,
      sortOrder: validated.sortOrder,
    })
    .returning();

  revalidatePath(`/s/[subdomain]/assets`);
  return { type: created };
}

export async function updateOrgAssetTypeAction(
  orgId: string,
  typeId: string,
  data: z.input<typeof orgAssetTypeSchema>
) {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);
  const validated = orgAssetTypeSchema.parse(data);

  const [updated] = await db
    .update(orgAssetTypes)
    .set({
      name: validated.name,
      label: validated.label,
      description: validated.description || null,
      color: validated.color,
      icon: validated.icon || null,
      sortOrder: validated.sortOrder,
      updatedAt: new Date(),
    })
    .where(and(eq(orgAssetTypes.id, typeId), eq(orgAssetTypes.orgId, orgId)))
    .returning();

  if (!updated) {
    throw new Error('Asset type not found');
  }

  revalidatePath(`/s/[subdomain]/assets`);
  return { type: updated };
}

export async function deleteOrgAssetTypeAction(orgId: string, typeId: string) {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);

  const [deleted] = await db
    .delete(orgAssetTypes)
    .where(and(eq(orgAssetTypes.id, typeId), eq(orgAssetTypes.orgId, orgId)))
    .returning();

  if (!deleted) {
    throw new Error('Asset type not found');
  }

  revalidatePath(`/s/[subdomain]/assets`);
  return { success: true };
}

// ============================================================================
// CUSTOM ASSET STATUSES
// ============================================================================

export async function getOrgAssetStatusesAction(orgId: string): Promise<OrgAssetStatus[]> {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);
  return db.query.orgAssetStatuses.findMany({
    where: eq(orgAssetStatuses.orgId, orgId),
    orderBy: [asc(orgAssetStatuses.sortOrder), asc(orgAssetStatuses.label)],
  });
}

export async function createOrgAssetStatusAction(
  orgId: string,
  data: z.input<typeof orgAssetStatusSchema>
) {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);
  const validated = orgAssetStatusSchema.parse(data);

  const [created] = await db
    .insert(orgAssetStatuses)
    .values({
      orgId,
      name: validated.name,
      label: validated.label,
      description: validated.description || null,
      color: validated.color,
      sortOrder: validated.sortOrder,
    })
    .returning();

  revalidatePath(`/s/[subdomain]/assets`);
  return { status: created };
}

export async function updateOrgAssetStatusAction(
  orgId: string,
  statusId: string,
  data: z.input<typeof orgAssetStatusSchema>
) {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);
  const validated = orgAssetStatusSchema.parse(data);

  const [updated] = await db
    .update(orgAssetStatuses)
    .set({
      name: validated.name,
      label: validated.label,
      description: validated.description || null,
      color: validated.color,
      sortOrder: validated.sortOrder,
      updatedAt: new Date(),
    })
    .where(and(eq(orgAssetStatuses.id, statusId), eq(orgAssetStatuses.orgId, orgId)))
    .returning();

  if (!updated) {
    throw new Error('Asset status not found');
  }

  revalidatePath(`/s/[subdomain]/assets`);
  return { status: updated };
}

export async function deleteOrgAssetStatusAction(orgId: string, statusId: string) {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);

  const [deleted] = await db
    .delete(orgAssetStatuses)
    .where(and(eq(orgAssetStatuses.id, statusId), eq(orgAssetStatuses.orgId, orgId)))
    .returning();

  if (!deleted) {
    throw new Error('Asset status not found');
  }

  revalidatePath(`/s/[subdomain]/assets`);
  return { success: true };
}

// ============================================================================
// COMBINED FETCH - Get all asset configuration for an org
// ============================================================================

export interface AssetConfig {
  types: OrgAssetType[];
  statuses: OrgAssetStatus[];
  defaultTypes: { name: string; label: string; color: string }[];
  defaultStatuses: { name: string; label: string; color: string }[];
}

export async function getAssetConfigAction(orgId: string): Promise<AssetConfig> {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);

  const [types, statuses] = await Promise.all([
    getOrgAssetTypesAction(orgId),
    getOrgAssetStatusesAction(orgId),
  ]);

  // Default system types
  const defaultTypes = [
    { name: 'AP', label: 'Access Point', color: '#10B981' },
    { name: 'SWITCH', label: 'Switch', color: '#3B82F6' },
    { name: 'FIREWALL', label: 'Firewall', color: '#EF4444' },
    { name: 'CAMERA', label: 'Camera', color: '#8B5CF6' },
    { name: 'NVR', label: 'NVR', color: '#F59E0B' },
    { name: 'SERVER', label: 'Server', color: '#6366F1' },
    { name: 'ISP_CIRCUIT', label: 'ISP Circuit', color: '#EC4899' },
    { name: 'OTHER', label: 'Other', color: '#6B7280' },
  ];

  // Default system statuses
  const defaultStatuses = [
    { name: 'ACTIVE', label: 'Active', color: '#10B981' },
    { name: 'RETIRED', label: 'Retired', color: '#6B7280' },
    { name: 'MAINTENANCE', label: 'Maintenance', color: '#F59E0B' },
  ];

  return {
    types,
    statuses,
    defaultTypes,
    defaultStatuses,
  };
}
