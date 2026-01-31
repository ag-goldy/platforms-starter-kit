'use server';

import { db } from '@/db';
import { assets, organizations, tickets, ticketAssets } from '@/db/schema';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function linkCustomerAssetToTicketAction(ticketId: string, assetId: string) {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  await requireOrgMemberRole(ticket.orgId, ['CUSTOMER_ADMIN']);

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

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, ticket.orgId),
    columns: { subdomain: true },
  });
  if (org?.subdomain) {
    revalidatePath(`/s/${org.subdomain}/tickets/${ticketId}`);
  }

  return { success: true };
}

export async function unlinkCustomerAssetFromTicketAction(ticketId: string, assetId: string) {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  await requireOrgMemberRole(ticket.orgId, ['CUSTOMER_ADMIN']);

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

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, ticket.orgId),
    columns: { subdomain: true },
  });
  if (org?.subdomain) {
    revalidatePath(`/s/${org.subdomain}/tickets/${ticketId}`);
  }

  return { success: true };
}
