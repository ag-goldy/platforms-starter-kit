import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { tickets, memberships, ticketAssets, assets } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// GET - Get linked assets for a ticket
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get ticket
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, id),
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Check membership
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.orgId, ticket.orgId),
        eq(memberships.isActive, true)
      ),
    });

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get linked assets
    const linkedAssets = await db.query.ticketAssets.findMany({
      where: eq(ticketAssets.ticketId, id),
      with: {
        asset: true,
      },
    });

    const mappedAssets = linkedAssets.map((la) => ({
      id: la.asset.id,
      name: la.asset.name,
      type: la.asset.type,
      hostname: la.asset.hostname,
      ipAddress: la.asset.ipAddress,
      status: la.asset.status,
      zabbixHostId: la.asset.zabbixHostId,
      isZabbixSynced: !!la.asset.zabbixHostId,
      linkedAt: la.createdAt,
    }));

    return NextResponse.json({ assets: mappedAssets });
  } catch (error) {
    console.error('Error fetching ticket assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
    );
  }
}

// POST - Link an asset to a ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { assetId } = body;

    if (!assetId) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }

    // Get ticket
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, id),
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Check membership
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.orgId, ticket.orgId),
        eq(memberships.isActive, true)
      ),
    });

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Verify asset belongs to same org
    const asset = await db.query.assets.findFirst({
      where: and(
        eq(assets.id, assetId),
        eq(assets.orgId, ticket.orgId)
      ),
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Create link
    const [linked] = await db
      .insert(ticketAssets)
      .values({
        ticketId: id,
        assetId: assetId,
      })
      .returning();

    return NextResponse.json({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      hostname: asset.hostname,
      ipAddress: asset.ipAddress,
      status: asset.status,
      zabbixHostId: asset.zabbixHostId,
      isZabbixSynced: !!asset.zabbixHostId,
      linkedAt: linked.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('Error linking asset:', error);
    return NextResponse.json(
      { error: 'Failed to link asset' },
      { status: 500 }
    );
  }
}

// DELETE - Unlink an asset from a ticket
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');

    if (!assetId) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }

    // Get ticket
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, id),
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Check membership
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.orgId, ticket.orgId),
        eq(memberships.isActive, true)
      ),
    });

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Delete link
    await db
      .delete(ticketAssets)
      .where(
        and(
          eq(ticketAssets.ticketId, id),
          eq(ticketAssets.assetId, assetId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unlinking asset:', error);
    return NextResponse.json(
      { error: 'Failed to unlink asset' },
      { status: 500 }
    );
  }
}
