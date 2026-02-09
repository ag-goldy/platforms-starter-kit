import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { kbArticles, kbArticleFeedback, organizations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth';

// POST /api/kb/articles/[id]/feedback - Submit feedback for an article
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { helpful, comment } = body;

    if (typeof helpful !== 'boolean') {
      return NextResponse.json(
        { error: 'Helpful field is required' },
        { status: 400 }
      );
    }

    // Get current user (optional - feedback can be anonymous)
    const session = await auth();
    const userId = session?.user?.id;

    // Check if article exists and is published
    const article = await db.query.kbArticles.findFirst({
      where: eq(kbArticles.id, id),
    });

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    if (article.status !== 'published') {
      return NextResponse.json(
        { error: 'Article is not available' },
        { status: 404 }
      );
    }

    // Create feedback record
    await db.insert(kbArticleFeedback).values({
      articleId: id,
      userId: userId || null,
      helpful,
      comment: comment || null,
    });

    // Update article helpful/not helpful counts
    if (helpful) {
      await db
        .update(kbArticles)
        .set({ helpfulCount: article.helpfulCount + 1 })
        .where(eq(kbArticles.id, id));
    } else {
      await db
        .update(kbArticles)
        .set({ notHelpfulCount: article.notHelpfulCount + 1 })
        .where(eq(kbArticles.id, id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to submit feedback:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
