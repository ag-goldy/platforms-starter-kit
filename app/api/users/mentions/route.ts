import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { users, memberships } from '@/db/schema';
import { eq, and, or, ilike, ne } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const query = searchParams.get('q') || '';

    if (!orgId) {
      return NextResponse.json({ error: 'Org ID required' }, { status: 400 });
    }

    const orgUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .innerJoin(memberships, eq(users.id, memberships.userId))
      .where(
        and(
          eq(memberships.orgId, orgId),
          eq(memberships.isActive, true),
          ne(users.id, session.user.id),
          or(
            ilike(users.name, `%${query}%`),
            ilike(users.email, `%${query}%`)
          )
        )
      )
      .limit(10);

    return NextResponse.json(orgUsers);
  } catch (error) {
    console.error('[Mentions API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
