/**
 * Public Status Page API
 *
 * Returns current status information for the organization
 * This endpoint is publicly accessible and meant for customer portals
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { services, statuspageConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createStatuspageClient } from "@/lib/integrations/statuspage/client";
import { getOrgBySubdomain } from "@/lib/subdomains/org-lookup";

// Cache status data for 60 seconds to avoid hitting API limits
const CACHE_TTL_MS = 60 * 1000;
const statusCache = new Map<string, { data: unknown; timestamp: number }>();

// GET /api/public/status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subdomain = searchParams.get("subdomain");

    if (!subdomain) {
      return NextResponse.json(
        { error: "Subdomain required" },
        { status: 400 },
      );
    }

    // Get organization
    const org = await getOrgBySubdomain(subdomain);

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    // Check cache
    const cacheKey = `status_${org.id}`;
    const cached = statusCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: {
          "X-Cache": "HIT",
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    // Check if Statuspage integration is enabled
    const statuspageConfig = await db.query.statuspageConfigs?.findFirst({
      where: eq(statuspageConfigs.orgId, org.id),
    });

    // Get services from Atlas
    const orgServices = await db.query.services?.findMany({
      where: eq(services.orgId, org.id),
      orderBy: (services, { asc }) => [asc(services.name)],
    });

    let statuspageData = null;
    let components = [];
    let incidents = [];

    // If Statuspage integration is configured, fetch data from there
    if (statuspageConfig?.isActive && statuspageConfig.apiKey) {
      try {
        const client = await createStatuspageClient(org.id);
        if (client) {
          const [fetchedComponents, fetchedIncidents] = await Promise.all([
            client.listComponents(),
            client.listIncidents({ status: "unresolved", limit: 10 }),
          ]);

          components = fetchedComponents.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            status: c.status,
            position: c.position,
            group: c.group,
          }));

          incidents = fetchedIncidents.map((i) => ({
            id: i.id,
            name: i.name,
            status: i.status,
            impact: i.impact,
            createdAt: i.created_at,
            updatedAt: i.updated_at,
            resolvedAt: i.resolved_at,
            shortlink: i.shortlink,
            affectedComponents: i.components?.map((c) => c.name) || [],
          }));

          statuspageData = {
            pageUrl: statuspageConfig.pageUrl,
            lastSyncedAt: statuspageConfig.lastSyncedAt,
          };
        }
      } catch (err) {
        console.error("Error fetching statuspage data:", err);
        // Fall back to Atlas services data
      }
    }

    // If no components from Statuspage, use Atlas services
    if (components.length === 0 && orgServices) {
      components = orgServices.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        status: mapAtlasStatusToComponentStatus(s.status),
        position: 0,
        group: false,
      }));
    }

    // Calculate overall status
    const overallStatus = calculateOverallStatus(components);

    const response = {
      organization: {
        id: org.id,
        name: org.name,
        branding: org.branding,
      },
      overallStatus,
      components,
      incidents,
      statuspage: statuspageData,
      lastUpdated: new Date().toISOString(),
    };

    // Update cache
    statusCache.set(cacheKey, { data: response, timestamp: Date.now() });

    return NextResponse.json(response, {
      headers: {
        "X-Cache": "MISS",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error) {
    console.error("Error fetching public status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

function mapAtlasStatusToComponentStatus(status: string): string {
  const mapping: Record<string, string> = {
    active: "operational",
    degraded: "degraded_performance",
    offline: "major_outage",
  };
  return mapping[status.toLowerCase()] || "operational";
}

function calculateOverallStatus(components: Array<{ status: string }>): string {
  if (components.length === 0) return "operational";

  const statusCounts: Record<string, number> = {};
  for (const c of components) {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  }

  // Priority order: major_outage > partial_outage > degraded_performance > under_maintenance > operational
  if (statusCounts["major_outage"] > 0) return "major_outage";
  if (statusCounts["partial_outage"] > 0) return "partial_outage";
  if (statusCounts["degraded_performance"] > 0) return "degraded_performance";
  if (statusCounts["under_maintenance"] > 0) return "under_maintenance";
  return "operational";
}
