import { NextResponse } from 'next/server';
import { db } from '@/db';
import { kbArticles } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const orgId = searchParams.get('orgId');

  if (!slug) {
    return NextResponse.json({ exists: false, error: 'Slug is required' }, { status: 400 });
  }

  try {
    // Check for existing slug
    // If orgId provided -> check within that org
    // If no orgId -> check global articles (null orgId)
    let existing;
    
    if (orgId) {
      existing = await db
        .select({ id: kbArticles.id })
        .from(kbArticles)
        .where(and(
          eq(kbArticles.slug, slug),
          eq(kbArticles.orgId, orgId)
        ))
        .limit(1);
    } else {
      // Check global articles (null orgId)
      existing = await db
        .select({ id: kbArticles.id })
        .from(kbArticles)
        .where(and(
          eq(kbArticles.slug, slug),
          isNull(kbArticles.orgId)
        ))
        .limit(1);
    }

    return NextResponse.json({ exists: existing.length > 0 });
  } catch (error) {
    console.error('Error checking slug:', error);
    return NextResponse.json(
      { exists: false, error: 'Failed to check slug' },
      { status: 500 }
    );
  }
}
