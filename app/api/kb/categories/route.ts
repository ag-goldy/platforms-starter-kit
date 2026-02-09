import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { kbCategories, organizations, kbArticles } from '@/db/schema';
import { eq, and, asc, desc, isNull } from 'drizzle-orm';
import { auth } from '@/auth';

// GET /api/kb/categories - List categories
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgSlug = searchParams.get('org');
    const orgId = searchParams.get('orgId');
    const includeInternal = searchParams.get('includeInternal') === 'true';

    let organizationId: string | undefined;

    // Support both org slug (for public) and orgId (for admin)
    if (orgSlug) {
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.subdomain, orgSlug),
      });
      if (!org) {
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 404 }
        );
      }
      organizationId = org.id;
    } else if (orgId) {
      organizationId = orgId;
    }

    // Build query conditions
    let conditions = undefined;
    if (organizationId) {
      conditions = eq(kbCategories.orgId, organizationId);
    } else if (!includeInternal) {
      // For public API without org filter, show global public categories
      conditions = isNull(kbCategories.orgId);
    }

    // For public API, only show public categories
    if (!includeInternal) {
      if (conditions) {
        conditions = and(conditions, eq(kbCategories.isPublic, true));
      } else {
        conditions = eq(kbCategories.isPublic, true);
      }
    }

    console.log('[KB Categories API] Query conditions:', conditions ? 'has conditions' : 'no conditions');
    
    const categories = await db.query.kbCategories.findMany({
      where: conditions,
      orderBy: [asc(kbCategories.sortOrder), asc(kbCategories.name)],
    });

    console.log('[KB Categories API] Found categories:', categories.length);

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

// POST /api/kb/categories - Create a new category
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, parentId, orgId, isPublic = true, sortOrder = 0 } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 100);

    // Check for duplicate slug
    let existing;
    if (orgId) {
      existing = await db.query.kbCategories.findFirst({
        where: and(
          eq(kbCategories.slug, slug),
          eq(kbCategories.orgId, orgId)
        ),
      });
    } else {
      // Global category - check for duplicate in global scope
      existing = await db.query.kbCategories.findFirst({
        where: and(
          eq(kbCategories.slug, slug),
          isNull(kbCategories.orgId)
        ),
      });
    }

    if (existing) {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 409 }
      );
    }

    const [category] = await db
      .insert(kbCategories)
      .values({
        name,
        slug,
        description: description || null,
        orgId: orgId || null,
        parentId: parentId || null,
        isPublic,
        sortOrder,
      })
      .returning();

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error('Failed to create category:', error);
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}

// DELETE /api/kb/categories?id=xxx - Delete a category
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('id');

    if (!categoryId) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      );
    }

    // Check if category has articles
    const articles = await db.query.kbArticles.findMany({
      where: eq(kbArticles.categoryId, categoryId),
      limit: 1,
    });

    if (articles.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category with articles. Move or delete articles first.' },
        { status: 400 }
      );
    }

    // Check if category has subcategories
    const subcategories = await db.query.kbCategories.findMany({
      where: eq(kbCategories.parentId, categoryId),
      limit: 1,
    });

    if (subcategories.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category with subcategories. Move or delete subcategories first.' },
        { status: 400 }
      );
    }

    await db.delete(kbCategories).where(eq(kbCategories.id, categoryId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete category:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}
