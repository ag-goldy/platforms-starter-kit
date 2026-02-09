'use server';

import { db } from '@/db';
import { assets, tickets, ticketAssets } from '@/db/schema';
import { requireInternalRole } from '@/lib/auth/permissions';
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function linkAssetToTicketAction(ticketId: string, assetId: string) {
  await requireInternalRole();

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, assetId),
  });
  if (!asset) {
    throw new Error('Asset not found');
  }

  if (asset.orgId !== ticket.orgId) {
    throw new Error('Asset does not belong to this organization');
  }

  await db
    .insert(ticketAssets)
    .values({
      ticketId,
      assetId,
      createdAt: new Date(),
    })
    .onConflictDoNothing();

  revalidatePath(`/app/tickets/${ticketId}`);
  return { success: true };
}

export async function unlinkAssetFromTicketAction(ticketId: string, assetId: string) {
  await requireInternalRole();

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, assetId),
  });
  if (!asset) {
    throw new Error('Asset not found');
  }

  if (asset.orgId !== ticket.orgId) {
    throw new Error('Asset does not belong to this organization');
  }

  await db
    .delete(ticketAssets)
    .where(
      and(
        eq(ticketAssets.ticketId, ticketId),
        eq(ticketAssets.assetId, assetId)
      )
    );

  revalidatePath(`/app/tickets/${ticketId}`);
  return { success: true };
}

/**
 * Find asset by serial number within an organization
 */
export async function findAssetBySerialNumberAction(serialNumber: string, orgId: string) {
  await requireInternalRole();

  if (!serialNumber || serialNumber.trim().length < 3) {
    return null;
  }

  const asset = await db.query.assets.findFirst({
    where: and(
      eq(assets.orgId, orgId),
      eq(assets.serialNumber, serialNumber.trim())
    ),
    with: {
      site: true,
      area: true,
    },
  });

  return asset;
}

/**
 * Find asset by hostname within an organization
 */
export async function findAssetByHostnameAction(hostname: string, orgId: string) {
  await requireInternalRole();

  if (!hostname || hostname.trim().length < 3) {
    return null;
  }

  const asset = await db.query.assets.findFirst({
    where: and(
      eq(assets.orgId, orgId),
      eq(assets.hostname, hostname.trim())
    ),
    with: {
      site: true,
      area: true,
    },
  });

  return asset;
}

/**
 * Link asset to ticket by serial number and update ticket with asset reference
 */
export async function linkAssetToTicketBySerialAction(ticketId: string, serialNumber: string) {
  await requireInternalRole();

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  const asset = await db.query.assets.findFirst({
    where: and(
      eq(assets.orgId, ticket.orgId),
      eq(assets.serialNumber, serialNumber.trim())
    ),
  });

  if (!asset) {
    throw new Error(`Asset with serial number "${serialNumber}" not found in this organization`);
  }

  // Link asset to ticket
  await db
    .insert(ticketAssets)
    .values({
      ticketId,
      assetId: asset.id,
      createdAt: new Date(),
    })
    .onConflictDoNothing();

  // Update ticket with asset reference for quick lookup
  await db
    .update(tickets)
    .set({
      assetSerialNumber: asset.serialNumber,
      assetHostname: asset.hostname,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, ticketId));

  revalidatePath(`/app/tickets/${ticketId}`);
  return { success: true, asset };
}

/**
 * Link asset to ticket by hostname and update ticket with asset reference
 */
export async function linkAssetToTicketByHostnameAction(ticketId: string, hostname: string) {
  await requireInternalRole();

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  const asset = await db.query.assets.findFirst({
    where: and(
      eq(assets.orgId, ticket.orgId),
      eq(assets.hostname, hostname.trim())
    ),
  });

  if (!asset) {
    throw new Error(`Asset with hostname "${hostname}" not found in this organization`);
  }

  // Link asset to ticket
  await db
    .insert(ticketAssets)
    .values({
      ticketId,
      assetId: asset.id,
      createdAt: new Date(),
    })
    .onConflictDoNothing();

  // Update ticket with asset reference for quick lookup
  await db
    .update(tickets)
    .set({
      assetSerialNumber: asset.serialNumber,
      assetHostname: asset.hostname,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, ticketId));

  revalidatePath(`/app/tickets/${ticketId}`);
  return { success: true, asset };
}

/**
 * Search assets by serial number or hostname (partial match)
 */
export async function searchAssetsByIdentifierAction(query: string, orgId: string) {
  await requireInternalRole();

  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchTerm = query.trim().toLowerCase();

  const assetsList = await db.query.assets.findMany({
    where: and(
      eq(assets.orgId, orgId),
      // Use SQL for case-insensitive partial matching
      sql`(
        LOWER(${assets.serialNumber}) LIKE ${'%' + searchTerm + '%'} OR
        LOWER(${assets.hostname}) LIKE ${'%' + searchTerm + '%'} OR
        LOWER(${assets.name}) LIKE ${'%' + searchTerm + '%'}
      )`
    ),
    with: {
      site: true,
      area: true,
    },
    limit: 10,
  });

  return assetsList;
}
