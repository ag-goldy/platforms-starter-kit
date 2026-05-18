import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { incidents, incidentUpdates } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { requireOrgRole } from "@/lib/auth/permissions";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/incidents/[id]/updates
 * Get all updates for an incident
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const resolvedParams = await params;
    const incidentId = resolvedParams.id;

    const [incident] = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, incidentId))
      .limit(1);

    if (!incident) {
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 },
      );
    }

    // Verify user has access to this org
    // Note: Internal users (ADMIN, AGENT) bypass role check automatically
    await requireOrgRole(incident.orgId, ["CUSTOMER_ADMIN"]);

    const updates = await db
      .select()
      .from(incidentUpdates)
      .where(eq(incidentUpdates.incidentId, incidentId))
      .orderBy(desc(incidentUpdates.createdAt));

    return NextResponse.json({ updates });
  } catch (error) {
    console.error("[API] Failed to fetch incident updates:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch updates",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/incidents/[id]/updates
 * Add an update to an incident
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const resolvedParams = await params;
    const incidentId = resolvedParams.id;

    const [incident] = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, incidentId))
      .limit(1);

    if (!incident) {
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 },
      );
    }

    // Verify user has admin/agent role
    // Note: Internal users (ADMIN, AGENT) bypass role check automatically
    await requireOrgRole(incident.orgId, ["CUSTOMER_ADMIN"]);

    const body = await request.json();
    const { status, message } = body;

    if (!status || !message) {
      return NextResponse.json(
        { error: "status and message are required" },
        { status: 400 },
      );
    }

    // Create the update
    const [update] = await db
      .insert(incidentUpdates)
      .values({
        incidentId,
        status,
        message,
        createdBy: user.id,
      })
      .returning();

    // Update the incident status
    const incidentUpdates_data: Partial<typeof incidents.$inferInsert> = {
      status,
      updatedAt: new Date(),
    };

    // If status changed to resolved, set resolvedAt
    if (status === "resolved" && incident.status !== "resolved") {
      incidentUpdates_data.resolvedAt = new Date();
    }

    await db
      .update(incidents)
      .set(incidentUpdates_data)
      .where(eq(incidents.id, incidentId));

    return NextResponse.json({ update }, { status: 201 });
  } catch (error) {
    console.error("[API] Failed to create incident update:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create update",
      },
      { status: 500 },
    );
  }
}
