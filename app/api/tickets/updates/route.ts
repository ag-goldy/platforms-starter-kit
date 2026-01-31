import { NextRequest, NextResponse } from 'next/server';
import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { tickets } from '@/db/schema';
import { inArray } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    await requireInternalRole();

    const body = await request.json();
    const { ticketIds }: { ticketIds: string[] } = body;

    if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
      return NextResponse.json({ updates: [] });
    }

    const ticketUpdates = await db.query.tickets.findMany({
      where: inArray(tickets.id, ticketIds),
      columns: {
        id: true,
        updatedAt: true,
        status: true,
        priority: true,
      },
    });

    return NextResponse.json({
      updates: ticketUpdates.map((t) => ({
        ticketId: t.id,
        updatedAt: t.updatedAt.toISOString(),
        status: t.status,
        priority: t.priority,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch ticket updates' },
      { status: 500 }
    );
  }
}
