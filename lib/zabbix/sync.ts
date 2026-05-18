/**
 * Zabbix Sync Service
 * 
 * Syncs monitoring data from Zabbix to local database
 */

import { ZabbixClient, ZabbixTrigger } from './client';
import { db } from '@/db';
import { assets } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  getZabbixConfigByOrgId,
  getServicesWithMonitoring,
  updateServiceMonitoring,
  addMonitoringHistory,
} from './queries';
import { processTriggerEvents } from '@/lib/monitoring/auto-ticket';

export interface SyncResult {
  serviceId: string;
  serviceName: string;
  success: boolean;
  status: string;
  error?: string;
  triggersCount?: number;
  problemsCount?: number;
  autoTickets?: Array<{
    triggerId: string;
    action: 'created' | 'resolved' | 'skipped';
    ticketKey?: string;
    error?: string;
  }>;
}

export interface AssetSyncResult {
  assetId: string;
  assetName: string;
  zabbixHostId: string;
  action: 'created' | 'updated';
  success: boolean;
  status: string;
  error?: string;
  triggersCount?: number;
  problemsCount?: number;
  autoTickets?: SyncResult['autoTickets'];
}

/**
 * Calculate monitoring status based on triggers
 */
function calculateStatus(triggers: ZabbixTrigger[]): string {
  const problems = triggers.filter(t => t.value === '1');
  
  if (problems.length === 0) {
    return 'OPERATIONAL';
  }

  // Check priority levels
  const critical = problems.filter(t => t.priority === '5'); // Disaster
  const high = problems.filter(t => t.priority === '4'); // High
  
  if (critical.length > 0) {
    return 'CRITICAL';
  }
  if (high.length > 0) {
    return 'DEGRADED';
  }
  
  return 'MINOR_ISSUES';
}

/**
 * Calculate uptime percentage based on trigger history
 * This is a simplified calculation - in production, you might want
 * to use Zabbix SLA calculations or item history
 */
function calculateUptime(triggers: ZabbixTrigger[]): number {
  if (triggers.length === 0) return 100;
  
  const problems = triggers.filter(t => t.value === '1');
  const operational = triggers.length - problems.length;
  
  return Math.round((operational / triggers.length) * 100 * 100) / 100;
}

/**
 * Sync a single service with Zabbix
 */
async function syncService(
  client: ZabbixClient,
  service: { id: string; name: string; zabbixHostId: string | null; monitoringEnabled: boolean | null },
  orgId: string
): Promise<SyncResult> {
  if (!service.zabbixHostId || !service.monitoringEnabled) {
    return {
      serviceId: service.id,
      serviceName: service.name,
      success: true,
      status: 'NOT_CONFIGURED',
    };
  }

  try {
    // Get host info
    console.log(`[Zabbix Sync] Fetching host ${service.zabbixHostId} from Zabbix`);
    const host = await client.getHostById(service.zabbixHostId);
    if (!host) {
      throw new Error('Host not found in Zabbix');
    }
    console.log(`[Zabbix Sync] Found host: ${host.name}`);

    // Get triggers for the host
    const triggers = await client.getTriggersByHostId(service.zabbixHostId);
    console.log(`[Zabbix Sync] Found ${triggers.length} triggers, ${triggers.filter(t => t.value === '1').length} problems`);
    
    // Calculate status
    const status = calculateStatus(triggers);
    const uptimePercentage = calculateUptime(triggers);
    const problemsCount = triggers.filter(t => t.value === '1').length;

    // Get response time if available (look for common item keys)
    const responseTimeItems = await client.getItemsByHostId(service.zabbixHostId, 'response');
    let responseTimeMs: number | undefined;
    
    if (responseTimeItems.length > 0 && responseTimeItems[0].lastvalue) {
      responseTimeMs = Math.round(parseFloat(responseTimeItems[0].lastvalue));
    }

    // Update service in database
    await updateServiceMonitoring(service.id, {
      zabbixHostName: host.name,
      zabbixTriggers: triggers,
      monitoringStatus: status,
      uptimePercentage: uptimePercentage.toString(),
      responseTimeMs,
      lastSyncedAt: new Date(),
    });

    // Add history record
    await addMonitoringHistory(service.id, {
      status,
      uptimePercentage: uptimePercentage.toString(),
      responseTimeMs,
      alertsCount: problemsCount,
      details: {
        triggers: triggers.map(t => ({
          id: t.triggerid,
          description: t.description,
          priority: t.priority,
          status: t.value === '1' ? 'PROBLEM' : 'OK',
        })),
      },
    });

    // Process auto-ticket creation for problem triggers
    let autoTickets: SyncResult['autoTickets'] = [];
    if (triggers.length > 0) {
      autoTickets = await processTriggerEvents(orgId, service.zabbixHostId, host.name, triggers);
    }

    return {
      serviceId: service.id,
      serviceName: service.name,
      success: true,
      status,
      triggersCount: triggers.length,
      problemsCount,
      autoTickets,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Update service with error status
    await updateServiceMonitoring(service.id, {
      monitoringStatus: 'ERROR',
      lastSyncedAt: new Date(),
    });

    return {
      serviceId: service.id,
      serviceName: service.name,
      success: false,
      status: 'ERROR',
      error: errorMessage,
    };
  }
}

/**
 * Sync all services for an organization
 */
export async function syncOrgServices(orgId: string): Promise<SyncResult[]> {
  const config = await getZabbixConfigByOrgId(orgId);
  
  if (!config || !config.isActive) {
    throw new Error('Zabbix not configured for this organization');
  }

  const client = new ZabbixClient({
    apiUrl: config.apiUrl,
    apiToken: config.apiToken,
  });

  // Test connection first
  const testResult = await client.testConnection();
  if (!testResult.success) {
    throw new Error(`Zabbix connection failed: ${testResult.error}`);
  }

  // Get all services for org
  const services = await getServicesWithMonitoring(orgId);
  console.log(`[Zabbix Sync] Found ${services.length} services for org ${orgId}`);
  
  // Sync each service
  const results: SyncResult[] = [];
  for (const service of services) {
    console.log(`[Zabbix Sync] Syncing service: ${service.name} (hostId: ${service.zabbixHostId}, enabled: ${service.monitoringEnabled})`);
    const result = await syncService(client, service, orgId);
    console.log(`[Zabbix Sync] Result:`, result);
    results.push(result);
  }

  return results;
}

/**
 * Sync Zabbix hosts into the asset inventory.
 *
 * Hosts are matched by assets.zabbixHostId. New hosts become SERVER assets so
 * they are visible in asset search and can be linked to auto-created tickets.
 */
export async function syncOrgAssets(orgId: string): Promise<AssetSyncResult[]> {
  const config = await getZabbixConfigByOrgId(orgId);

  if (!config || !config.isActive) {
    throw new Error('Zabbix not configured for this organization');
  }

  const client = new ZabbixClient({
    apiUrl: config.apiUrl,
    apiToken: config.apiToken,
  });

  const testResult = await client.testConnection();
  if (!testResult.success) {
    throw new Error(`Zabbix connection failed: ${testResult.error}`);
  }

  const hosts = await client.getHosts();
  const results: AssetSyncResult[] = [];

  for (const host of hosts) {
    try {
      const triggers = await client.getTriggersByHostId(host.hostid);
      const status = calculateStatus(triggers);
      const problemsCount = triggers.filter((trigger) => trigger.value === '1').length;

      const existing = await db.query.assets.findFirst({
        where: and(eq(assets.orgId, orgId), eq(assets.zabbixHostId, host.hostid)),
      });

      const values = {
        name: host.name || host.host,
        hostname: host.host || host.name,
        type: 'SERVER',
        zabbixHostId: host.hostid,
        zabbixHostName: host.name || host.host,
        zabbixTriggers: triggers,
        monitoringEnabled: true,
        monitoringStatus: status,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      };

      let assetId: string;
      let action: AssetSyncResult['action'];

      if (existing) {
        const [updated] = await db
          .update(assets)
          .set(values)
          .where(eq(assets.id, existing.id))
          .returning();

        assetId = updated?.id || existing.id;
        action = 'updated';
      } else {
        const [created] = await db
          .insert(assets)
          .values({
            orgId,
            ...values,
            status: host.available === '1' ? 'ACTIVE' : 'MAINTENANCE',
            createdAt: new Date(),
          })
          .returning();

        assetId = created.id;
        action = 'created';
      }

      const autoTickets = triggers.length > 0
        ? await processTriggerEvents(orgId, host.hostid, host.name || host.host, triggers)
        : [];

      results.push({
        assetId,
        assetName: host.name || host.host,
        zabbixHostId: host.hostid,
        action,
        success: true,
        status,
        triggersCount: triggers.length,
        problemsCount,
        autoTickets,
      });
    } catch (error) {
      results.push({
        assetId: '',
        assetName: host.name || host.host,
        zabbixHostId: host.hostid,
        action: 'updated',
        success: false,
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Sync a single service by ID
 */
export async function syncSingleService(
  orgId: string,
  serviceId: string
): Promise<SyncResult> {
  const config = await getZabbixConfigByOrgId(orgId);
  
  if (!config || !config.isActive) {
    throw new Error('Zabbix not configured for this organization');
  }

  const client = new ZabbixClient({
    apiUrl: config.apiUrl,
    apiToken: config.apiToken,
  });

  const services = await getServicesWithMonitoring(orgId);
  const service = services.find(s => s.id === serviceId);
  
  if (!service) {
    throw new Error('Service not found');
  }

  return syncService(client, service, orgId);
}
