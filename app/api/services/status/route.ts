import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { services, serviceMonitoringHistory, zabbixConfigs } from '@/db/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';

// GET /api/services/status?subdomain=xxx - Get service status for a subdomain
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subdomain = searchParams.get('subdomain');

    if (!subdomain) {
      return NextResponse.json(
        { error: 'Subdomain is required' },
        { status: 400 }
      );
    }

    const org = await getOrgBySubdomain(subdomain);

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get services for this org
    const orgServices = await db.query.services.findMany({
      where: eq(services.orgId, org.id),
      orderBy: [desc(services.createdAt)],
    });

    // Get Zabbix config for this org
    const zabbixConfig = await db.query.zabbixConfigs.findFirst({
      where: eq(zabbixConfigs.orgId, org.id),
    });

    // Get monitoring history for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const serviceIds = orgServices.map(s => s.id);
    
    const monitoringHistory = serviceIds.length > 0 
      ? await db
          .select()
          .from(serviceMonitoringHistory)
          .where(
            and(
              gte(serviceMonitoringHistory.timestamp, thirtyDaysAgo)
            )
          )
          .orderBy(desc(serviceMonitoringHistory.timestamp))
      : [];

    // Calculate uptime statistics
    const uptimeStats = calculateUptimeStats(monitoringHistory);

    // Get recent incidents (from Zabbix triggers)
    const recentIncidents = monitoringHistory
      .filter(h => h.status === 'DOWN' || h.status === 'PROBLEM')
      .slice(0, 10);

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        subdomain: org.subdomain,
      },
      services: orgServices.map(service => ({
        ...service,
        status: getServiceStatus(service),
      })),
      uptimeStats,
      recentIncidents,
      hasZabbixIntegration: !!zabbixConfig && zabbixConfig.isActive,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch service status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service status' },
      { status: 500 }
    );
  }
}

function getServiceStatus(service: { monitoringStatus: string | null; status: string }): string {
  if (service.status === 'INACTIVE') return 'INACTIVE';
  return service.monitoringStatus || 'UNKNOWN';
}

function calculateUptimeStats(history: { status: string; timestamp: Date }[]) {
  if (history.length === 0) {
    return {
      overallUptime: 100,
      totalChecks: 0,
      upChecks: 0,
      downChecks: 0,
    };
  }

  const upChecks = history.filter(h => h.status === 'UP' || h.status === 'OK').length;
  const totalChecks = history.length;
  const overallUptime = totalChecks > 0 ? (upChecks / totalChecks) * 100 : 100;

  return {
    overallUptime: Math.round(overallUptime * 100) / 100,
    totalChecks,
    upChecks,
    downChecks: totalChecks - upChecks,
  };
}
