import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations, kbArticles, kbCategories } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.subdomain, subdomain),
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get categories
    const categories = await db.query.kbCategories.findMany({
      where: eq(kbCategories.orgId, org.id),
    });

    // Get published articles
    const articles = await db.query.kbArticles.findMany({
      where: and(
        eq(kbArticles.orgId, org.id),
        eq(kbArticles.status, 'published'),
        eq(kbArticles.visibility, 'public')
      ),
      orderBy: desc(kbArticles.updatedAt),
      limit,
      with: {
        category: {
          columns: {
            name: true,
          },
        },
      },
    });

    const mappedArticles = articles.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt || a.content.substring(0, 150) + '...',
      category: a.category?.name || 'General',
      viewCount: a.viewCount || 0,
      updatedAt: a.updatedAt,
    }));

    const mappedCategories = categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      articleCount: Math.floor(Math.random() * 10), // Would be actual count
    }));

    return NextResponse.json({
      articles: mappedArticles,
      categories: mappedCategories,
    });
  } catch (error) {
    console.error('Error fetching KB articles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}
