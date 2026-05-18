import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { memberships, organizations } from '@/db/schema';
import { searchKnowledgeAndAssets } from '@/lib/search/phase4';
import { and, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const orgId = searchParams.get('orgId');
    const subdomain = searchParams.get('subdomain');
    const limit = Number.parseInt(searchParams.get('limit') || '20', 10);

    let resolvedOrgId = orgId || '';
    let resolvedSubdomain = subdomain || null;

    if (!resolvedOrgId && subdomain) {
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.subdomain, subdomain),
        columns: {
          id: true,
          subdomain: true,
        },
      });
      resolvedOrgId = org?.id || '';
      resolvedSubdomain = org?.subdomain || subdomain;
    }

    if (!resolvedOrgId) {
      return NextResponse.json({ error: 'Organization is required' }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.isPlatformAdmin) {
      const membership = await db.query.memberships.findFirst({
        where: and(
          eq(memberships.orgId, resolvedOrgId),
          eq(memberships.userId, session.user.id),
          eq(memberships.isActive, true)
        ),
      });

      if (!membership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const results = await searchKnowledgeAndAssets(resolvedOrgId, q, {
      subdomain: resolvedSubdomain,
      limit: Number.isFinite(limit) ? limit : 20,
      includeInternalKb: true,
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Phase 4 search failed:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
