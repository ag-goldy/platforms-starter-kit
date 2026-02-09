/**
 * Trigger Zabbix Sync
 * POST /api/zabbix/sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { syncOrgServices, syncSingleService } from '@/lib/zabbix/sync';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orgId, serviceId } = body;

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Verify user has access to this org
    await requireOrgMemberRole(orgId);

    // Sync either single service or all services
    if (serviceId) {
      const result = await syncSingleService(orgId, serviceId);
      return NextResponse.json({ results: [result] });
    } else {
      const results = await syncOrgServices(orgId);
      return NextResponse.json({ results });
    }
  } catch (error) {
    console.error('[Zabbix Sync API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
