import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { ticketSubtasks, tickets } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const subtaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
});

// GET /api/tickets/[id]/subtasks
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: ticketId } = await params;

    const subtasks = await db.query.ticketSubtasks.findMany({
      where: eq(ticketSubtasks.ticketId, ticketId),
      orderBy: (subtasks, { asc }) => [asc(subtasks.sortOrder)],
      with: {
        assignee: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ subtasks });
  } catch (error) {
    console.error('Error fetching subtasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subtasks' },
      { status: 500 }
    );
  }
}

// POST /api/tickets/[id]/subtasks
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: ticketId } = await params;
    const body = await req.json();
    
    const parsed = subtaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Get current max sort order
    const existingSubtasks = await db.query.ticketSubtasks.findMany({
      where: eq(ticketSubtasks.ticketId, ticketId),
      orderBy: (subtasks, { desc }) => [desc(subtasks.sortOrder)],
      limit: 1,
    });
    
    const sortOrder = existingSubtasks.length > 0 ? existingSubtasks[0].sortOrder + 1 : 0;

    // Get ticket to find orgId
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, ticketId),
      columns: { orgId: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const [subtask] = await db
      .insert(ticketSubtasks)
      .values({
        ticketId,
        orgId: ticket.orgId!,
        title: parsed.data.title,
        description: parsed.data.description || null,
        assigneeId: parsed.data.assigneeId || null,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        status: parsed.data.status,
        sortOrder,
        createdById: session.user.id,
      })
      .returning();

    return NextResponse.json({ subtask }, { status: 201 });
  } catch (error) {
    console.error('Error creating subtask:', error);
    return NextResponse.json(
      { error: 'Failed to create subtask' },
      { status: 500 }
    );
  }
}

// PATCH /api/tickets/[id]/subtasks
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: ticketId } = await params;
    const { searchParams } = new URL(req.url);
    const subtaskId = searchParams.get('subtaskId');

    if (!subtaskId) {
      return NextResponse.json(
        { error: 'Subtask ID required' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const updates: Partial<typeof body> = {};

    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.assigneeId !== undefined) updates.assigneeId = body.assigneeId || null;
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.status !== undefined) updates.status = body.status;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

    const [subtask] = await db
      .update(ticketSubtasks)
      .set(updates)
      .where(
        and(
          eq(ticketSubtasks.id, subtaskId),
          eq(ticketSubtasks.ticketId, ticketId)
        )
      )
      .returning();

    return NextResponse.json({ subtask });
  } catch (error) {
    console.error('Error updating subtask:', error);
    return NextResponse.json(
      { error: 'Failed to update subtask' },
      { status: 500 }
    );
  }
}

// DELETE /api/tickets/[id]/subtasks
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: ticketId } = await params;
    const { searchParams } = new URL(req.url);
    const subtaskId = searchParams.get('subtaskId');

    if (!subtaskId) {
      return NextResponse.json(
        { error: 'Subtask ID required' },
        { status: 400 }
      );
    }

    await db
      .delete(ticketSubtasks)
      .where(
        and(
          eq(ticketSubtasks.id, subtaskId),
          eq(ticketSubtasks.ticketId, ticketId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subtask:', error);
    return NextResponse.json(
      { error: 'Failed to delete subtask' },
      { status: 500 }
    );
  }
}
