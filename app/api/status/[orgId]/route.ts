/**
 * Organization Status API
 * 
 * Returns real-time status for all services in an organization.
 * Uses actual data from service_monitoring_history instead of mock data.
 * Results are cached in Redis for 5 minutes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { organizations, services, notices, serviceMonitoringHistory } from '@/db/schema';
import { eq, and, desc, gt, gte, sql } from 'drizzle-orm';
import { cached, CACHE_KEYS, CACHE_TTL } from '@/lib/redis/cache';

// Types
interface ServiceStatus {
  id: string;
  name: string;
  status: string;
  uptime24h: number;
  uptime7d: number;
  responseTimeMs?: number;
  lastCheckedAt?: Date;
}

interface Incident {
  id: string;
  title: string;
  severity: string;
  startedAt: Date;
  resolvedAt?: Date;
}

interface StatusResponse {
  overallStatus: 'operational' | 'warning' | 'critical';
  services: ServiceStatus[];
  incidents: Incident[];
  lastUpdated: string;
}

/**
 * Calculate uptime percentage from monitoring history
 */
async function calculateUptime(serviceId: string, hours: number): Promise<number> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const history = await db
    .select({
      status: serviceMonitoringHistory.status,
      count: sql<number>`count(*)::int`,
    })
    .from(serviceMonitoringHistory)
    .where(
      and(
        eq(serviceMonitoringHistory.serviceId, serviceId),
        gte(serviceMonitoringHistory.timestamp, since)
      )
    )
    .groupBy(serviceMonitoringHistory.status);
  
  if (history.length === 0) {
    return 100; // No data = assume 100% uptime
  }
  
  const total = history.reduce((sum, h) => sum + h.count, 0);
  const operational = history
    .filter(h => h.status === 'OPERATIONAL')
    .reduce((sum, h) => sum + h.count, 0);
  
  return Math.round((operational / total) * 100 * 100) / 100; // 2 decimal places
}

/**
 * Get latest monitoring data for a service
 */
async function getLatestMonitoring(serviceId: string) {
  const latest = await db.query.serviceMonitoringHistory.findFirst({
    where: eq(serviceMonitoringHistory.serviceId, serviceId),
    orderBy: desc(serviceMonitoringHistory.timestamp),
  });
  
  return latest;
}

/**
 * Fetch status data with caching
 */
async function fetchStatusData(orgId: string): Promise<StatusResponse> {
  return cached(
    CACHE_KEYS.statusSummary(orgId),
    CACHE_TTL.statusSummary,
    async () => {
      // Get services for this org
      const orgServices = await db.query.services.findMany({
        where: eq(services.orgId, orgId),
      });

      // Get recent incidents (notices with severity)
      const recentNotices = await db.query.notices.findMany({
        where: and(
          eq(notices.orgId, orgId),
          gt(notices.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        ),
        orderBy: desc(notices.createdAt),
        limit: 5,
      });

      // Calculate real uptime data for each service
      const mappedServices: ServiceStatus[] = await Promise.all(
        orgServices.map(async (s) => {
          const [uptime24h, uptime7d, latest] = await Promise.all([
            calculateUptime(s.id, 24),
            calculateUptime(s.id, 24 * 7),
            getLatestMonitoring(s.id),
          ]);

          return {
            id: s.id,
            name: s.name,
            status: s.status,
            uptime24h,
            uptime7d,
            responseTimeMs: latest?.responseTimeMs ?? undefined,
            lastCheckedAt: latest?.timestamp,
          };
        })
      );

      // Calculate overall status
      const hasDown = mappedServices.some((s) => s.status === 'OFFLINE');
      const hasDegraded = mappedServices.some((s) => s.status === 'DEGRADED');
      const overallStatus = hasDown ? 'critical' : hasDegraded ? 'warning' : 'operational';

      // Map incidents
      const mappedIncidents: Incident[] = recentNotices.map((n) => ({
        id: n.id,
        title: n.title,
        severity: n.severity,
        startedAt: n.createdAt,
        resolvedAt: n.resolvedAt ?? undefined,
      }));

      return {
        overallStatus,
        services: mappedServices,
        incidents: mappedIncidents,
        lastUpdated: new Date().toISOString(),
      };
    }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    
    // Verify org exists
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { id: true, name: true },
    });
    
    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Fetch status data (with caching)
    const data = await fetchStatusData(orgId);

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Status API] Error fetching status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}

// Revalidate every 60 seconds (ISR fallback)
export const revalidate = 60;
