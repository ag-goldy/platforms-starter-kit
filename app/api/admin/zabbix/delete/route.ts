import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { zabbixConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orgId } = body;

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const config = await db.query.zabbixConfigs.findFirst({
      where: eq(zabbixConfigs.orgId, orgId),
    });

    if (!config) {
      return NextResponse.json(
        { error: 'Zabbix configuration not found' },
        { status: 404 }
      );
    }

    await db.delete(zabbixConfigs).where(eq(zabbixConfigs.id, config.id));

    return NextResponse.json({
      success: true,
      message: 'Zabbix configuration deleted successfully',
    });
  } catch (error) {
    console.error('Zabbix delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete configuration' },
      { status: 500 }
    );
  }
}
