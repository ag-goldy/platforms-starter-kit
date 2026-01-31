'use server';

import { db } from '@/db';
import { assets, tickets, ticketAssets } from '@/db/schema';
import { requireInternalRole } from '@/lib/auth/permissions';
import { and, eq } from 'drizzle-orm';
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
