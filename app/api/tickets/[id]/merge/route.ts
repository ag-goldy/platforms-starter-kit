import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tickets, ticketComments, attachments, ticketAssets } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/session';
import { requireOrgRole } from '@/lib/auth/permissions';
import { logAudit } from '@/lib/audit/log';
import { invalidateTicketCache } from '@/lib/cache-invalidation';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tickets/[id]/merge
 * Merge source ticket into target ticket
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const resolvedParams = await params;
    const sourceTicketId = resolvedParams.id;

    const body = await request.json();
    const { targetTicketId } = body;

    if (!targetTicketId) {
      return NextResponse.json(
        { error: 'targetTicketId is required' },
        { status: 400 }
      );
    }

    if (sourceTicketId === targetTicketId) {
      return NextResponse.json(
        { error: 'Cannot merge a ticket into itself' },
        { status: 400 }
      );
    }

    // Fetch both tickets
    const [sourceTicket, targetTicket] = await Promise.all([
      db.query.tickets.findFirst({
        where: eq(tickets.id, sourceTicketId),
      }),
      db.query.tickets.findFirst({
        where: eq(tickets.id, targetTicketId),
      }),
    ]);

    if (!sourceTicket) {
      return NextResponse.json({ error: 'Source ticket not found' }, { status: 404 });
    }

    if (!targetTicket) {
      return NextResponse.json({ error: 'Target ticket not found' }, { status: 404 });
    }

    // Verify same org
    if (sourceTicket.orgId !== targetTicket.orgId) {
      return NextResponse.json(
        { error: 'Cannot merge tickets from different organizations' },
        { status: 400 }
      );
    }

    // Verify user has admin/agent role
    await requireOrgRole(sourceTicket.orgId!, ['ADMIN', 'AGENT']);

    // Check if either ticket is already closed or merged
    if (sourceTicket.status === 'CLOSED' || sourceTicket.status === 'MERGED') {
      return NextResponse.json(
        { error: 'Cannot merge a ticket that is already closed or merged' },
        { status: 400 }
      );
    }

    if (targetTicket.status === 'CLOSED' || targetTicket.status === 'MERGED') {
      return NextResponse.json(
        { error: 'Cannot merge into a ticket that is already closed or merged' },
        { status: 400 }
      );
    }

    // Start transaction for all operations
    await db.transaction(async (tx) => {
      // 1. Move comments from source to target
      await tx
        .update(ticketComments)
        .set({ ticketId: targetTicketId })
        .where(eq(ticketComments.ticketId, sourceTicketId));

      // 2. Move attachments from source to target
      await tx
        .update(attachments)
        .set({ ticketId: targetTicketId })
        .where(eq(attachments.ticketId, sourceTicketId));

      // 3. Move linked assets from source to target (only if not already linked)
      const existingAssets = await tx
        .select({ assetId: ticketAssets.assetId })
        .from(ticketAssets)
        .where(eq(ticketAssets.ticketId, targetTicketId));

      const existingAssetIds = existingAssets.map(a => a.assetId);

      const sourceAssets = await tx
        .select({ assetId: ticketAssets.assetId })
        .from(ticketAssets)
        .where(eq(ticketAssets.ticketId, sourceTicketId));

      const assetsToMove = sourceAssets
        .map(a => a.assetId)
        .filter(id => !existingAssetIds.includes(id));

      if (assetsToMove.length > 0) {
        await tx
          .update(ticketAssets)
          .set({ ticketId: targetTicketId })
          .where(
            and(
              eq(ticketAssets.ticketId, sourceTicketId),
              inArray(ticketAssets.assetId, assetsToMove)
            )
          );
      }

      // 4. Add system comment on target
      await tx.insert(ticketComments).values({
        ticketId: targetTicketId,
        content: `**Ticket Merged**: Merged from ${sourceTicket.key}. Original subject: ${sourceTicket.subject}`,
        isInternal: true,
        userId: user.id,
      });

      // 5. Add system comment on source
      await tx.insert(ticketComments).values({
        ticketId: sourceTicketId,
        content: `**Ticket Merged**: Merged into ${targetTicket.key}`,
        isInternal: true,
        userId: user.id,
      });

      // 6. Update source ticket status to MERGED
      await tx
        .update(tickets)
        .set({
          status: 'MERGED',
          mergedIntoId: targetTicketId,
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, sourceTicketId));
    });

    // Log audit
    await logAudit({
      userId: user.id,
      orgId: sourceTicket.orgId!,
      action: 'TICKET_MERGED',
      details: JSON.stringify({
        sourceTicketId,
        sourceTicketKey: sourceTicket.key,
        targetTicketId,
        targetTicketKey: targetTicket.key,
      }),
    });

    // Invalidate caches
    await invalidateTicketCache(sourceTicket.orgId!, sourceTicketId);
    await invalidateTicketCache(targetTicket.orgId!, targetTicketId);

    return NextResponse.json({
      success: true,
      message: `Ticket ${sourceTicket.key} merged into ${targetTicket.key}`,
      sourceTicket: { id: sourceTicketId, key: sourceTicket.key, status: 'MERGED' },
      targetTicket: { id: targetTicketId, key: targetTicket.key },
    });
  } catch (error) {
    console.error('[API] Failed to merge tickets:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to merge tickets' },
      { status: 500 }
    );
  }
}
