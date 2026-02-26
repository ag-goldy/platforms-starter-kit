import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { ticketDrafts } from '@/db/schema-extensions';
import { eq, and } from 'drizzle-orm';

// GET - Get draft for a ticket
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ticketId = params.id;
    const url = new URL(req.url);
    const draftType = url.searchParams.get('type') || 'comment';

    const draft = await db.query.ticketDrafts.findFirst({
      where: and(
        eq(ticketDrafts.ticketId, ticketId),
        eq(ticketDrafts.userId, session.user.id),
        eq(ticketDrafts.draftType, draftType)
      ),
    });

    if (!draft) {
      return NextResponse.json({ content: null });
    }

    return NextResponse.json({
      content: draft.content,
      attachments: draft.attachments,
      lastSavedAt: draft.lastSavedAt,
    });
  } catch (error) {
    console.error('Error fetching draft:', error);
    return NextResponse.json(
      { error: 'Failed to fetch draft' },
      { status: 500 }
    );
  }
}

// POST - Save draft
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ticketId = params.id;
    const { content, draftType = 'comment', attachments = [] } = await req.json();

    await db
      .insert(ticketDrafts)
      .values({
        ticketId,
        userId: session.user.id,
        draftType,
        content,
        attachments,
        lastSavedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          ticketDrafts.userId,
          ticketDrafts.ticketId,
          ticketDrafts.draftType,
        ],
        set: {
          content,
          attachments,
          lastSavedAt: new Date(),
        },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving draft:', error);
    return NextResponse.json(
      { error: 'Failed to save draft' },
      { status: 500 }
    );
  }
}

// DELETE - Delete draft
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ticketId = params.id;
    const url = new URL(req.url);
    const draftType = url.searchParams.get('type') || 'comment';

    await db
      .delete(ticketDrafts)
      .where(
        and(
          eq(ticketDrafts.ticketId, ticketId),
          eq(ticketDrafts.userId, session.user.id),
          eq(ticketDrafts.draftType, draftType)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting draft:', error);
    return NextResponse.json(
      { error: 'Failed to delete draft' },
      { status: 500 }
    );
  }
}
