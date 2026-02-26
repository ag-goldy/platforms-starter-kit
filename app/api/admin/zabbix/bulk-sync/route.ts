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

    const configs = await db.query.zabbixConfigs.findMany({
      where: eq(zabbixConfigs.isActive, true),
    });

    if (configs.length === 0) {
      return NextResponse.json(
        { error: 'No active Zabbix configurations found' },
        { status: 400 }
      );
    }

    const results = [];
    let totalHosts = 0;
    let totalServices = 0;
    let successCount = 0;

    for (const config of configs) {
      try {
        const result = await syncZabbixHosts(config);
        
        if (result.success) {
          totalHosts += result.hostsFetched || 0;
          totalServices += result.servicesUpdated || 0;
          successCount++;
          
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
      message: `Bulk sync completed: ${successCount}/${configs.length} configs synced. ${totalHosts} hosts fetched, ${totalServices} services updated.`,
      summary: {
        configsProcessed: configs.length,
        configsSynced: successCount,
        totalHostsFetched: totalHosts,
        totalServicesUpdated: totalServices,
      },
      details: results,
    });
  } catch (error) {
    console.error('Zabbix bulk sync error:', error);
    return NextResponse.json(
      { error: 'Bulk sync failed' },
      { status: 500 }
    );
  }
}

async function syncZabbixHosts(config: { apiUrl: string; apiToken: string; orgId: string }) {
  try {
    const baseUrl = config.apiUrl.replace(/\/api_jsonrpc\.php$/, '').replace(/\/$/, '');
    const rpcUrl = `${baseUrl}/api_jsonrpc.php`;

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

    const { services } = await import('@/db/schema');

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
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}
