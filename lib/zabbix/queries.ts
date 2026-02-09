/**
 * Zabbix Configuration and Service Monitoring Queries
 */

import { db } from '@/db';
import { zabbixConfigs, services, serviceMonitoringHistory, ZabbixConfig, Service } from '@/db/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import { ZabbixTrigger } from './client';

// Zabbix Config Queries

export async function getZabbixConfigByOrgId(orgId: string): Promise<ZabbixConfig | null> {
  const config = await db.query.zabbixConfigs.findFirst({
    where: eq(zabbixConfigs.orgId, orgId),
  });
  return config || null;
}

export async function createOrUpdateZabbixConfig(
  orgId: string,
  data: { apiUrl: string; apiToken: string; syncIntervalMinutes?: number }
): Promise<ZabbixConfig> {
  const existing = await getZabbixConfigByOrgId(orgId);

  if (existing) {
    const [updated] = await db
      .update(zabbixConfigs)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(zabbixConfigs.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(zabbixConfigs)
    .values({
      orgId,
      apiUrl: data.apiUrl,
      apiToken: data.apiToken,
      syncIntervalMinutes: data.syncIntervalMinutes || 5,
    })
    .returning();

  return created;
}

export async function deleteZabbixConfig(orgId: string): Promise<void> {
  await db.delete(zabbixConfigs).where(eq(zabbixConfigs.orgId, orgId));
}

// Service Monitoring Queries

export async function getServicesWithMonitoring(orgId: string): Promise<Service[]> {
  return db.query.services.findMany({
    where: eq(services.orgId, orgId),
    orderBy: (table, { asc }) => [asc(table.name)],
  });
}

export async function getServiceById(serviceId: string): Promise<Service | null> {
  const service = await db.query.services.findFirst({
    where: eq(services.id, serviceId),
  });
  return service || null;
}

export async function updateServiceMonitoring(
  serviceId: string,
  data: {
    zabbixHostId?: string;
    zabbixHostName?: string;
    zabbixTriggers?: ZabbixTrigger[];
    monitoringEnabled?: boolean;
    monitoringStatus?: string;
    uptimePercentage?: string;
    responseTimeMs?: number;
    lastSyncedAt?: Date;
  }
): Promise<Service> {
  const [updated] = await db
    .update(services)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(services.id, serviceId))
    .returning();

  return updated;
}

export async function addMonitoringHistory(
  serviceId: string,
  data: {
    status: string;
    uptimePercentage?: string;
    responseTimeMs?: number;
    alertsCount?: number;
    details?: Record<string, unknown>;
  }
): Promise<typeof serviceMonitoringHistory.$inferSelect> {
  const [created] = await db
    .insert(serviceMonitoringHistory)
    .values({
      serviceId,
      ...data,
    })
    .returning();

  return created;
}

export async function getMonitoringHistory(
  serviceId: string,
  hours: number = 24
): Promise<typeof serviceMonitoringHistory.$inferSelect[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return db.query.serviceMonitoringHistory.findMany({
    where: and(
      eq(serviceMonitoringHistory.serviceId, serviceId),
      gte(serviceMonitoringHistory.timestamp, since)
    ),
    orderBy: [desc(serviceMonitoringHistory.timestamp)],
    limit: 100,
  });
}

export async function getLatestMonitoringStatus(
  serviceId: string
): Promise<typeof serviceMonitoringHistory.$inferSelect | null> {
  const history = await db.query.serviceMonitoringHistory.findFirst({
    where: eq(serviceMonitoringHistory.serviceId, serviceId),
    orderBy: [desc(serviceMonitoringHistory.timestamp)],
  });
  return history || null;
}
