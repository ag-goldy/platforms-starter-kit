/**
 * Statuspage.io Individual Incident API
 *
 * GET    - Get incident details
 * PATCH  - Update incident
 * DELETE - Delete incident
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createStatuspageClient } from "@/lib/integrations/statuspage/client";
import { canManageOrgSettings, canManageTickets } from "@/lib/auth/permissions";
import { z } from "zod/v3";

const updateIncidentSchema = z.object({
  status: z
    .enum(["investigating", "identified", "monitoring", "resolved"])
    .optional(),
  body: z.string().optional(),
  impact: z.enum(["none", "minor", "major", "critical"]).optional(),
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/statuspage/incidents/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    const incident = await client.getIncident(id);
    return NextResponse.json({ incident });
  } catch (error) {
    console.error("Error fetching statuspage incident:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH /api/statuspage/incidents/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canManage = await canManageTickets(
      session.user.id,
      session.user.orgId,
    );
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = updateIncidentSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validated.error.flatten() },
        { status: 400 },
      );
    }

    const client = await createStatuspageClient(session.user.orgId);
    if (!client) {
      return NextResponse.json(
        { error: "Statuspage not configured for this organization" },
        { status: 404 },
      );
    }

    const {
      status,
      body: incidentBody,
      impact,
      componentIds,
      componentStatuses,
    } = validated.data;

    const incident = await client.updateIncident(id, {
      status,
      body: incidentBody,
      impact,
      component_ids: componentIds,
      components: componentStatuses,
    });

    return NextResponse.json({ incident });
  } catch (error) {
    console.error("Error updating statuspage incident:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/statuspage/incidents/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    await client.deleteIncident(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting statuspage incident:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
