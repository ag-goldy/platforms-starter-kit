import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { assets, ticketAssets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/permissions';
import { z } from 'zod';

// Archive/Unarchive schema
const archiveSchema = z.object({
  action: z.enum(['archive', 'unarchive']),
});

// GET /api/assets/[id] - Get asset details with ticket count
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuth();

    const asset = await db.query.assets.findFirst({
      where: eq(assets.id, id),
      with: {
        site: true,
        area: true,
        archivedByUser: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Get linked ticket count
    const linkedTickets = await db.query.ticketAssets.findMany({
      where: eq(ticketAssets.assetId, id),
      with: {
        ticket: {
          columns: {
            id: true,
            key: true,
            subject: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ 
      asset,
      linkedTickets: linkedTickets.map(lt => lt.ticket),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Failed to fetch asset:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asset' },
      { status: 500 }
    );
  }
}

// PATCH /api/assets/[id] - Update asset (including archive/unarchive)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const body = await request.json();

    // Check if it's an archive action
    const archiveResult = archiveSchema.safeParse(body);
    if (archiveResult.success) {
      const { action } = archiveResult.data;
      
      const updateData = action === 'archive' 
        ? { 
            archived: true, 
            archivedAt: new Date(), 
            archivedBy: user.id,
            updatedAt: new Date(),
          }
        : { 
            archived: false, 
            archivedAt: null, 
            archivedBy: null,
            updatedAt: new Date(),
          };

      const [updated] = await db
        .update(assets)
        .set(updateData)
        .where(eq(assets.id, id))
        .returning();

      if (!updated) {
        return NextResponse.json(
          { error: 'Asset not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ 
        asset: updated,
        message: action === 'archive' ? 'Asset archived' : 'Asset unarchived',
      });
    }

    // Regular update (name, status, etc.)
    const updateSchema = z.object({
      name: z.string().min(1).optional(),
      hostname: z.string().optional(),
      serialNumber: z.string().optional(),
      model: z.string().optional(),
      vendor: z.string().optional(),
      ipAddress: z.string().optional(),
      macAddress: z.string().optional(),
      status: z.enum(['ACTIVE', 'MAINTENANCE', 'RETIRED']).optional(),
      type: z.enum(['AP', 'SWITCH', 'FIREWALL', 'CAMERA', 'NVR', 'SERVER', 'ISP_CIRCUIT', 'OTHER']).optional(),
      siteId: z.string().uuid().nullable().optional(),
      areaId: z.string().uuid().nullable().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
    });

    const updateData = updateSchema.parse(body);

    const [updated] = await db
      .update(assets)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(assets.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ asset: updated });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Failed to update asset:', error);
    return NextResponse.json(
      { error: 'Failed to update asset' },
      { status: 500 }
    );
  }
}

// DELETE /api/assets/[id] - Delete asset
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAuth();

    // Check if asset exists
    const asset = await db.query.assets.findFirst({
      where: eq(assets.id, id),
    });

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Check for linked tickets
    const linkedTickets = await db.query.ticketAssets.findMany({
      where: eq(ticketAssets.assetId, id),
    });

    if (linkedTickets.length > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete asset with linked tickets',
          linkedTicketCount: linkedTickets.length,
        },
        { status: 409 }
      );
    }

    // Delete the asset
    await db.delete(assets).where(eq(assets.id, id));

    return NextResponse.json({ 
      success: true,
      message: 'Asset deleted successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Failed to delete asset:', error);
    return NextResponse.json(
      { error: 'Failed to delete asset' },
      { status: 500 }
    );
  }
}
