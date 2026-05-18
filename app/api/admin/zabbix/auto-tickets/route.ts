/**
 * Zabbix Auto-Ticket Configuration API
 *
 * GET  - Get auto-ticket status and stats
 * POST - Enable/disable auto-ticket creation
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { zabbixConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAutoTicketStats } from "@/lib/monitoring/auto-ticket";

// GET /api/admin/zabbix/auto-tickets?orgId=xxx
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID required" },
        { status: 400 },
      );
    }

    // Get Zabbix config
    const config = await db.query.zabbixConfigs.findFirst({
      where: eq(zabbixConfigs.orgId, orgId),
    });

    if (!config) {
      return NextResponse.json(
        { error: "Zabbix not configured" },
        { status: 404 },
      );
    }

    // Get stats for last 24 hours
    const stats = await getAutoTicketStats(orgId, 24);

    return NextResponse.json({
      enabled: config.isActive, // Using isActive as proxy - can be extended
      lastSyncedAt: config.lastSyncedAt,
      stats,
    });
  } catch (error) {
    console.error("Error fetching auto-ticket config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/admin/zabbix/auto-tickets
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orgId, enabled } = body;

    if (!orgId || typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "Organization ID and enabled status required" },
        { status: 400 },
      );
    }

    // Update config (using isActive as proxy for now)
    await db
      .update(zabbixConfigs)
      .set({
        isActive: enabled,
        updatedAt: new Date(),
      })
      .where(eq(zabbixConfigs.orgId, orgId));

    return NextResponse.json({
      success: true,
      enabled,
      message: enabled
        ? "Auto-ticket creation enabled"
        : "Auto-ticket creation disabled",
    });
  } catch (error) {
    console.error("Error updating auto-ticket config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
