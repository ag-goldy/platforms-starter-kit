import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { kbArticles } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/permissions';

// GET /api/kb/articles/[id] - Get a single article (by ID or slug)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const global = searchParams.get('global') === 'true';
    const bySlug = searchParams.get('bySlug') === 'true';

    // Build query conditions
    let whereCondition;
    if (bySlug || id.length < 36) {
      // Lookup by slug
      whereCondition = eq(kbArticles.slug, id);
    } else {
      // Lookup by ID
      whereCondition = eq(kbArticles.id, id);
    }

    const article = await db.query.kbArticles.findFirst({
      where: whereCondition,
      with: {
        category: true,
        author: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // If global flag is set, verify article has no org
    if (global && article.orgId !== null) {
      return NextResponse.json(
        { error: 'Article not found in global KB' },
        { status: 404 }
      );
    }

    // Increment view count
    await db
      .update(kbArticles)
      .set({ viewCount: (article.viewCount || 0) + 1 })
      .where(eq(kbArticles.id, article.id));

    return NextResponse.json({ article });
  } catch (error) {
    console.error('Failed to fetch article:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article' },
      { status: 500 }
    );
  }
}

// PATCH /api/kb/articles/[id] - Update an article
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const body = await request.json();

    const {
      title,
      slug,
      content,
      contentType,
      excerpt,
      categoryId,
      status,
      visibility,
      tags,
    } = body;

    // Check if article exists
    const existing = await db.query.kbArticles.findFirst({
      where: eq(kbArticles.id, id),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Check slug uniqueness if changed
    if (slug && slug !== existing.slug) {
      const slugExists = await db.query.kbArticles.findFirst({
        where: and(
          existing.orgId ? eq(kbArticles.orgId, existing.orgId) : isNull(kbArticles.orgId),
          eq(kbArticles.slug, slug)
        ),
      });

      if (slugExists) {
        return NextResponse.json(
          { error: 'An article with this slug already exists' },
          { status: 409 }
        );
      }
    }

    // Build update values
    const updateValues: Partial<typeof kbArticles.$inferInsert> = {};
    
    if (title !== undefined) updateValues.title = title;
    if (slug !== undefined) updateValues.slug = slug;
    if (content !== undefined) updateValues.content = content;
    if (contentType !== undefined) updateValues.contentType = contentType;
    if (excerpt !== undefined) updateValues.excerpt = excerpt;
    if (categoryId !== undefined) updateValues.categoryId = categoryId || null;
    if (status !== undefined) updateValues.status = status;
    if (visibility !== undefined) updateValues.visibility = visibility;
    if (tags !== undefined) updateValues.tags = tags;
    
    // Update publishedAt if status changed to published
    if (status === 'published' && existing.status !== 'published') {
      updateValues.publishedAt = new Date();
    }

    const [article] = await db
      .update(kbArticles)
      .set(updateValues)
      .where(eq(kbArticles.id, id))
      .returning();

    return NextResponse.json({ article });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Failed to update article:', error);
    return NextResponse.json(
      { error: 'Failed to update article' },
      { status: 500 }
    );
  }
}

// DELETE /api/kb/articles/[id] - Delete an article
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAuth();

    // Check if article exists
    const existing = await db.query.kbArticles.findFirst({
      where: eq(kbArticles.id, id),
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    await db.delete(kbArticles).where(eq(kbArticles.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Failed to delete article:', error);
    return NextResponse.json(
      { error: 'Failed to delete article' },
      { status: 500 }
    );
  }
}
