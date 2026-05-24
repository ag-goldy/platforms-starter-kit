/**
 * Statuspage.io Incidents API
 *
 * GET  - List incidents from Statuspage
 * POST - Create a new incident
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStatuspageAccess } from "@/lib/auth/statuspage-access";
import { createStatuspageClient } from "@/lib/integrations/statuspage/client";
import { canManageOrgSettings, canManageTickets } from "@/lib/auth/permissions";
import { z } from "zod/v3";

const createIncidentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  status: z
    .enum(["investigating", "identified", "monitoring", "resolved"])
    .default("investigating"),
  impact: z.enum(["none", "minor", "major", "critical"]).default("minor"),
  body: z.string().min(1, "Body is required"),
  componentIds: z.array(z.string()).optional(),
  componentStatuses: z
    .record(
      z.enum([
        "operational",
        "degraded_performance",
        "partial_outage",
        "major_outage",
      ]),
    )
    .optional(),
});

// GET /api/statuspage/incidents
export async function GET(request: NextRequest) {
  try {
    const access = await requireStatuspageAccess(canManageOrgSettings);
    if (!access.allowed) {
      return access.response;
    }

    const client = await createStatuspageClient(access.orgId);
    if (!client) {
      return NextResponse.json(
        { error: "Statuspage not configured for this organization" },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const limit = parseInt(searchParams.get("limit") || "25", 10);

    const incidents = await client.listIncidents({
      status: status || undefined,
      limit,
    });
    return NextResponse.json({ incidents });
  } catch (error) {
    console.error("Error fetching statuspage incidents:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/statuspage/incidents
export async function POST(request: NextRequest) {
  try {
    const access = await requireStatuspageAccess(canManageTickets);
    if (!access.allowed) {
      return access.response;
    }

    const body = await request.json();
    const validated = createIncidentSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validated.error.flatten() },
        { status: 400 },
      );
    }

    const client = await createStatuspageClient(access.orgId);
    if (!client) {
      return NextResponse.json(
        { error: "Statuspage not configured for this organization" },
        { status: 404 },
      );
    }

    const {
      name,
      status,
      impact,
      body: incidentBody,
      componentIds,
      componentStatuses,
    } = validated.data;

    const incident = await client.createIncident({
      name,
      status,
      impact,
      body: incidentBody,
      component_ids: componentIds,
      components: componentStatuses,
    });

    return NextResponse.json({ incident });
  } catch (error) {
    console.error("Error creating statuspage incident:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
