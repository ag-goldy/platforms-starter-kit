import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { kbArticles, kbCategories, organizations, users } from '@/db/schema';
import { eq, and, desc, asc, like, or, sql, isNull } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/permissions';

// GET /api/kb/articles - List articles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgSlug = searchParams.get('org');
    const categorySlug = searchParams.get('category');
    const search = searchParams.get('search');
    const status = searchParams.get('status') || 'published';
    const visibility = searchParams.get('visibility') || 'public';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const global = searchParams.get('global') === 'true';

    // Build base conditions
    const conditions: ReturnType<typeof and>[] = [];
    let orgId: string | null = null;

    if (global) {
      // Fetch global articles (no org assigned)
      conditions.push(isNull(kbArticles.orgId));
    } else if (orgSlug) {
      // Get organization
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.subdomain, orgSlug),
      });

      if (!org) {
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 404 }
        );
      }
      orgId = org.id;
      conditions.push(eq(kbArticles.orgId, orgId));
    } else {
      return NextResponse.json(
        { error: 'Organization slug or global flag required' },
        { status: 400 }
      );
    }

    // Add status filter (public access only sees published)
    if (status) {
      conditions.push(eq(kbArticles.status, status));
    }

    // Add visibility filter (public access only sees public)
    if (visibility) {
      conditions.push(eq(kbArticles.visibility, visibility));
    }

    // Add category filter
    if (categorySlug) {
      if (global) {
        // For global mode, look up category by slug only (no org filter)
        const category = await db.query.kbCategories.findFirst({
          where: and(
            isNull(kbCategories.orgId),
            eq(kbCategories.slug, categorySlug)
          ),
        });
        if (category) {
          conditions.push(eq(kbArticles.categoryId, category.id));
        }
      } else if (orgId) {
        // For org-specific mode, look up by org and slug
        const category = await db.query.kbCategories.findFirst({
          where: and(
            eq(kbCategories.orgId, orgId),
            eq(kbCategories.slug, categorySlug)
          ),
        });
        if (category) {
          conditions.push(eq(kbArticles.categoryId, category.id));
        }
      }
    }

    // Add search filter
    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(
        or(
          like(kbArticles.title, searchTerm),
          like(kbArticles.content, searchTerm),
          like(kbArticles.excerpt, searchTerm)
        )!
      );
    }

    // Determine sort order
    const orderBy = sortOrder === 'asc' 
      ? asc(sortBy === 'title' ? kbArticles.title : sortBy === 'viewCount' ? kbArticles.viewCount : kbArticles.createdAt)
      : desc(sortBy === 'title' ? kbArticles.title : sortBy === 'viewCount' ? kbArticles.viewCount : kbArticles.createdAt);

    console.log('[KB Articles API] Query conditions:', conditions.length);
    console.log('[KB Articles API] Global mode:', global);
    
    const articles = await db.query.kbArticles.findMany({
      where: and(...conditions),
      orderBy: [orderBy],
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

    console.log('[KB Articles API] Found articles:', articles.length);

    return NextResponse.json({ articles });
  } catch (error) {
    console.error('Failed to fetch articles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}

// Helper function to get abbreviation from text
function getAbbreviation(text: string): string {
  // Split by spaces, hyphens, or special chars and take first letter of each word
  const words = text.split(/[\s\-_,]+/).filter(w => w.length > 0);
  if (words.length === 1 && words[0].length >= 3) {
    // For single long words, take first 3 letters
    return words[0].substring(0, 3).toUpperCase();
  }
  // Take first letter of each word (max 4 letters)
  return words.slice(0, 4).map(w => w[0].toUpperCase()).join('');
}

// Helper function to generate KB ID
async function generateKbId(categoryId: string | null, orgId: string | null): Promise<string> {
  let categoryAbbr = 'GEN';
  let parentAbbr = '';

  if (categoryId) {
    // Get category info
    const category = await db.query.kbCategories.findFirst({
      where: eq(kbCategories.id, categoryId),
    });

    if (category) {
      categoryAbbr = getAbbreviation(category.name);

      // Check if category has a parent
      if (category.parentId) {
        const parent = await db.query.kbCategories.findFirst({
          where: eq(kbCategories.id, category.parentId),
        });
        if (parent) {
          parentAbbr = getAbbreviation(parent.name);
        }
      }
    }
  }

  // Generate random 4-digit number
  let randomNum = Math.floor(1000 + Math.random() * 9000);

  // Build the format: KB-CATEGORYABBR-RANDOM or KB-PARENT/CATEGORY-RANDOM
  let kbId: string;
  if (parentAbbr) {
    kbId = `KB-${parentAbbr}/${categoryAbbr}-${randomNum}`;
  } else {
    kbId = `KB-${categoryAbbr}-${randomNum}`;
  }

  // Check for uniqueness and regenerate if needed
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100;

  while (!isUnique && attempts < maxAttempts) {
    const existing = await db.query.kbArticles.findFirst({
      where: eq(kbArticles.slug, kbId),
    });

    if (!existing) {
      isUnique = true;
    } else {
      // Generate new random number
      randomNum = Math.floor(1000 + Math.random() * 9000);
      if (parentAbbr) {
        kbId = `KB-${parentAbbr}/${categoryAbbr}-${randomNum}`;
      } else {
        kbId = `KB-${categoryAbbr}-${randomNum}`;
      }
      attempts++;
    }
  }

  return kbId;
}

// POST /api/kb/articles - Create a new article
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const {
      orgId,
      categoryId,
      title,
      content,
      contentType = 'markdown',
      excerpt,
      status = 'draft',
      visibility = 'public',
      tags = [],
    } = body;

    // Validate required fields (orgId can be null for global articles)
    if (!title || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: title, content' },
        { status: 400 }
      );
    }

    // Generate unique KB ID
    const kbId = await generateKbId(categoryId || null, orgId || null);

    // Create article with KB ID as slug
    const [article] = await db
      .insert(kbArticles)
      .values({
        orgId,
        categoryId: categoryId || null,
        title,
        slug: kbId,
        content,
        contentType,
        excerpt: excerpt || null,
        status,
        visibility,
        authorId: user.id,
        tags,
        publishedAt: status === 'published' ? new Date() : null,
      })
      .returning();

    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthorizationError') {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    console.error('Failed to create article:', error);
    return NextResponse.json(
      { error: 'Failed to create article' },
      { status: 500 }
    );
  }
}
