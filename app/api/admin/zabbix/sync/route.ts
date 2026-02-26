import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { zabbixConfigs, services } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';

// POST /api/admin/zabbix/sync - Trigger manual sync for an org or all orgs
export async function POST(request: NextRequest) {
  try {
    // Check cron secret or session auth
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    let isAuthorized = false;
    
    // Try cron auth first
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
    } else {
      // Fall back to session auth
      const session = await auth();
      if (session?.user) {
        isAuthorized = true;
      }
    }
    
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { orgId } = body;

    // If orgId provided, sync just that org
    if (orgId) {
      return await syncSingleOrg(orgId);
    }
    
    // Otherwise, sync all active Zabbix configs
    return await syncAllOrgs();
    
  } catch (error) {
    console.error('Zabbix sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed' },
      { status: 500 }
    );
  }
}

async function syncSingleOrg(orgId: string) {
  const config = await db.query.zabbixConfigs.findFirst({
    where: eq(zabbixConfigs.orgId, orgId),
  });

  if (!config) {
    return NextResponse.json(
      { error: 'Zabbix configuration not found' },
      { status: 404 }
    );
  }

  if (!config.isActive) {
    return NextResponse.json(
      { error: 'Zabbix integration is disabled' },
      { status: 400 }
    );
  }

  const result = await syncZabbixHosts(config);

  await db
    .update(zabbixConfigs)
    .set({ lastSyncedAt: new Date() })
    .where(eq(zabbixConfigs.id, config.id));

  return NextResponse.json(result);
}

async function syncAllOrgs() {
  const configs = await db.query.zabbixConfigs.findMany({
    where: eq(zabbixConfigs.isActive, true),
  });

  const results = [];
  let totalHosts = 0;
  let totalServices = 0;

  for (const config of configs) {
    try {
      const result = await syncZabbixHosts(config);
      
      if (result.success) {
        totalHosts += result.hostsFetched || 0;
        totalServices += result.servicesUpdated || 0;
        
        await db
          .update(zabbixConfigs)
          .set({ lastSyncedAt: new Date() })
          .where(eq(zabbixConfigs.id, config.id));
      }
      
      results.push({
        orgId: config.orgId,
        ...result,
      });
    } catch (err) {
      results.push({
        orgId: config.orgId,
        success: false,
        error: err instanceof Error ? err.message : 'Sync failed',
      });
    }
  }

  return NextResponse.json({
    success: true,
    summary: {
      configsProcessed: configs.length,
      totalHostsFetched: totalHosts,
      totalServicesUpdated: totalServices,
    },
    details: results,
  });
}

async function syncZabbixHosts(config: { apiUrl: string; apiToken: string; orgId: string }) {
  try {
    const baseUrl = config.apiUrl.replace(/\/api_jsonrpc\.php$/, '').replace(/\/$/, '');
    const rpcUrl = `${baseUrl}/api_jsonrpc.php`;

    // Fetch hosts from Zabbix
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'host.get',
        params: {
          output: ['hostid', 'host', 'name', 'status', 'available'],
          selectInterfaces: ['ip', 'dns'],
          selectTriggers: ['triggerid', 'description', 'priority', 'status', 'value'],
        },
        id: 1,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return {
        success: false,
        error: data.error.message,
      };
    }

    const hosts = data.result || [];

    // Update services with matching Zabbix host IDs
    let updatedCount = 0;
    for (const host of hosts) {
      const matchingService = await db.query.services.findFirst({
        where: eq(services.name, host.name),
      });

      if (matchingService) {
        await db
          .update(services)
          .set({
            zabbixHostId: host.hostid,
            zabbixHostName: host.name,
            monitoringStatus: host.available === '1' ? 'OPERATIONAL' : 'DOWN',
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(services.id, matchingService.id));
        updatedCount++;
      }
    }

    return {
      success: true,
      hostsFetched: hosts.length,
      servicesUpdated: updatedCount,
      message: `Synced ${hosts.length} Zabbix hosts. Updated ${updatedCount} services.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}
