'use server';

import { db } from '@/db';
import { tickets, organizations } from '@/db/schema';
import { requireInternalRole } from '@/lib/auth/permissions';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

/**
 * Assign a ticket to an organization
 * This is used for public tickets that were created without an org
 */
export async function assignTicketToOrgAction(
  ticketId: string,
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireInternalRole();

    // Verify organization exists
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    if (!org) {
      return { success: false, error: 'Organization not found' };
    }

    // Update the ticket
    await db
      .update(tickets)
      .set({
        orgId: org.id,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticketId));

    // Log the assignment
    const { logAudit } = await import('@/lib/audit/log');
    await logAudit({
      userId: user.id,
      ticketId,
      action: 'TICKET_ASSIGNED',
      details: JSON.stringify({ orgId: org.id, orgName: org.name }),
    });

    revalidatePath(`/app/tickets/${ticketId}`);
    revalidatePath('/app/tickets');

    return { success: true };
  } catch (error: any) {
    console.error('[Assign Ticket to Org] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all organizations for dropdown
 */
export async function getOrganizationsForAssignmentAction(): Promise<
  Array<{ id: string; name: string }>
> {
  await requireInternalRole();

  const orgs = await db.query.organizations.findMany({
    orderBy: (table, { asc }) => [asc(table.name)],
    columns: { id: true, name: true },
  });

  return orgs;
}
