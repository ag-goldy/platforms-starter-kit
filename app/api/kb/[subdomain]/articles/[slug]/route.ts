import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations, kbArticles } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subdomain: string; slug: string }> }
) {
  try {
    const { subdomain, slug } = await params;
    
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.subdomain, subdomain),
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const article = await db.query.kbArticles.findFirst({
      where: and(
        eq(kbArticles.orgId, org.id),
        eq(kbArticles.slug, slug),
        eq(kbArticles.status, 'published')
      ),
      with: {
        category: {
          columns: {
            name: true,
          },
        },
      },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: article.id,
      title: article.title,
      slug: article.slug,
      content: article.content,
      category: article.category?.name || 'General',
      viewCount: article.viewCount || 0,
      helpfulCount: article.helpfulCount || 0,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching KB article:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article' },
      { status: 500 }
    );
  }
}
