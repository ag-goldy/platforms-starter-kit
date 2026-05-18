/**
 * Statuspage.io Sync API
 *
 * POST - Sync Atlas services with Statuspage components
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { services, statuspageConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createStatuspageClient } from "@/lib/integrations/statuspage/client";
import { canManageOrgSettings } from "@/lib/auth/permissions";

interface SyncResult {
  created: Array<{
    serviceId: string;
    serviceName: string;
    componentId: string;
  }>;
  updated: Array<{
    serviceId: string;
    serviceName: string;
    componentId: string;
  }>;
  errors: Array<{ serviceId: string; serviceName: string; error: string }>;
}

// POST /api/statuspage/sync
export async function POST(_: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canManage = await canManageOrgSettings(
      session.user.id,
      session.user.orgId,
    );
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const client = await createStatuspageClient(session.user.orgId);
    if (!client) {
      return NextResponse.json(
        { error: "Statuspage not configured for this organization" },
        { status: 404 },
      );
    }

    // Get config for mappings
    const config = await db.query.statuspageConfigs?.findFirst({
      where: eq(statuspageConfigs.orgId, session.user.orgId),
    });

    if (!config) {
      return NextResponse.json(
        { error: "Statuspage configuration not found" },
        { status: 404 },
      );
    }

    // Get all services for this org
    const orgServices = await db.query.services?.findMany({
      where: eq(services.orgId, session.user.orgId),
    });

    if (!orgServices || orgServices.length === 0) {
      return NextResponse.json(
        { error: "No services found to sync" },
        { status: 400 },
      );
    }

    // Get existing statuspage components
    const existingComponents = await client.listComponents();
    const componentMap = new Map(
      existingComponents.map((c) => [c.name.toLowerCase(), c]),
    );

    const result: SyncResult = {
      created: [],
      updated: [],
      errors: [],
    };

    const newMappings: Record<string, string> = { ...config.componentMappings };

    for (const service of orgServices) {
      try {
        // Map service status to statuspage component status
        const componentStatus = client.mapServiceStatus(
          service.status.toLowerCase(),
        );

        // Check if we already have a mapping
        const existingComponentId = config.componentMappings[service.id];

        // Also check by name match
        const nameMatch = componentMap.get(service.name.toLowerCase());

        if (existingComponentId) {
          // Update existing component
          await client.updateComponent(existingComponentId, {
            name: service.name,
            status: componentStatus,
          });
          result.updated.push({
            serviceId: service.id,
            serviceName: service.name,
            componentId: existingComponentId,
          });
        } else if (nameMatch) {
          // Use name-matched component and create mapping
          await client.updateComponent(nameMatch.id, {
            status: componentStatus,
          });
          newMappings[service.id] = nameMatch.id;
          result.updated.push({
            serviceId: service.id,
            serviceName: service.name,
            componentId: nameMatch.id,
          });
        } else {
          // Create new component
          const newComponent = await client.createComponent({
            name: service.name,
            description: service.description || undefined,
            status: componentStatus,
          });
          newMappings[service.id] = newComponent.id;
          result.created.push({
            serviceId: service.id,
            serviceName: service.name,
            componentId: newComponent.id,
          });
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        result.errors.push({
          serviceId: service.id,
          serviceName: service.name,
          error: errorMessage,
        });
      }
    }

    // Update mappings in database
    await db
      .update(statuspageConfigs)
      .set({
        componentMappings: newMappings,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(statuspageConfigs.id, config.id));

    return NextResponse.json({
      success: true,
      result,
      totalServices: orgServices.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error syncing statuspage:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// GET /api/statuspage/sync
export async function GET(_: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canManage = await canManageOrgSettings(
      session.user.id,
      session.user.orgId,
    );
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const config = await db.query.statuspageConfigs?.findFirst({
      where: eq(statuspageConfigs.orgId, session.user.orgId),
      columns: {
        componentMappings: true,
        lastSyncedAt: true,
        autoSyncServices: true,
      },
    });

    if (!config) {
      return NextResponse.json({
        configured: false,
        mappings: {},
        lastSyncedAt: null,
      });
    }

    // Count how many services are mapped
    const mappedServiceCount = Object.keys(
      config.componentMappings || {},
    ).length;
    const totalServices =
      (await db.query.services?.count?.({
        where: eq(services.orgId, session.user.orgId),
      })) || 0;

    return NextResponse.json({
      configured: true,
      mappings: config.componentMappings,
      lastSyncedAt: config.lastSyncedAt,
      autoSyncServices: config.autoSyncServices,
      stats: {
        mappedServices: mappedServiceCount,
        totalServices,
        unmappedServices: totalServices - mappedServiceCount,
      },
    });
  } catch (error) {
    console.error("Error fetching sync status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
