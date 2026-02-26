import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { memberships } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;

    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.orgId, orgId),
        eq(memberships.isActive, true)
      ),
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 404 });
    }

    return NextResponse.json({
      role: membership.role,
      joinedAt: membership.createdAt,
    });
  } catch (error) {
    console.error('Error fetching membership:', error);
    return NextResponse.json(
      { error: 'Failed to fetch membership' },
      { status: 500 }
    );
  }
}
