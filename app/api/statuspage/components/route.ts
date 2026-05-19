/**
 * Statuspage.io Components API
 *
 * GET  - List components from Statuspage
 * POST - Create a new component
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createStatuspageClient } from "@/lib/integrations/statuspage/client";
import { canManageOrgSettings } from "@/lib/auth/permissions";
import { z } from "zod/v3";

const createComponentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z
    .enum([
      "operational",
      "degraded_performance",
      "partial_outage",
      "major_outage",
      "under_maintenance",
    ])
    .default("operational"),
  groupId: z.string().optional(),
});

// GET /api/statuspage/components
export async function GET(_request: NextRequest) {
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

    const components = await client.listComponents();
    return NextResponse.json({ components });
  } catch (error) {
    console.error("Error fetching statuspage components:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/statuspage/components
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validated = createComponentSchema.safeParse(body);

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

    const component = await client.createComponent(validated.data);
    return NextResponse.json({ component });
  } catch (error) {
    console.error("Error creating statuspage component:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
