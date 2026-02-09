/**
 * Get Zabbix Hosts
 * GET /api/zabbix/hosts?orgId=<orgId>&search=<search>
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { getZabbixConfigByOrgId } from '@/lib/zabbix/queries';
import { ZabbixClient } from '@/lib/zabbix/client';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const search = searchParams.get('search') || undefined;

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Verify user has access to this org
    await requireOrgMemberRole(orgId);

    // Get Zabbix config
    const config = await getZabbixConfigByOrgId(orgId);
    if (!config || !config.isActive) {
      return NextResponse.json(
        { error: 'Zabbix not configured for this organization' },
        { status: 404 }
      );
    }

    // Fetch hosts from Zabbix
    const client = new ZabbixClient({
      apiUrl: config.apiUrl,
      apiToken: config.apiToken,
    });

    const hosts = await client.getHosts(search);

    return NextResponse.json({ hosts });
  } catch (error) {
    console.error('[Zabbix Hosts API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch hosts' },
      { status: 500 }
    );
  }
}
