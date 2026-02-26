import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { assets, memberships } from '@/db/schema';
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

    // Check membership
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.orgId, orgId),
        eq(memberships.isActive, true)
      ),
    });

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all assets for the org
    const orgAssets = await db.query.assets.findMany({
      where: eq(assets.orgId, orgId),
      orderBy: assets.name,
    });

    // Map with status
    const mappedAssets = orgAssets.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      hostname: a.hostname,
      ipAddress: a.ipAddress,
      status: a.status,
      zabbixHostId: a.zabbixHostId,
      isZabbixSynced: !!a.zabbixHostId,
    }));

    return NextResponse.json({ assets: mappedAssets });
  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
    );
  }
}
