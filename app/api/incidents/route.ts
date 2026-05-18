import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { incidents, incidentUpdates, services } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { requireOrgRole } from "@/lib/auth/permissions";

/**
 * GET /api/incidents?orgId=xxx
 * List incidents for an organization
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const status = searchParams.get("status");

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID required" },
        { status: 400 },
      );
    }

    // Verify user has access to this org
    // Note: Internal users (ADMIN, AGENT) bypass role check automatically
    await requireOrgRole(orgId, ["CUSTOMER_ADMIN"]);

    const conditions = [eq(incidents.orgId, orgId)];

    // Filter by status if provided
    if (status) {
      conditions.push(eq(incidents.status, status));
    }

    const results = await db
      .select()
      .from(incidents)
      .where(and(...conditions))
      .orderBy(desc(incidents.createdAt));

    // Get updates for each incident
    const incidentsWithUpdates = await Promise.all(
      results.map(async (incident) => {
        const updates = await db
          .select()
          .from(incidentUpdates)
          .where(eq(incidentUpdates.incidentId, incident.id))
          .orderBy(desc(incidentUpdates.createdAt));

        // Get affected services names
        let affectedServices: { id: string; name: string }[] = [];
        if (incident.servicesAffected && incident.servicesAffected.length > 0) {
          const svcResults = await db
            .select({ id: services.id, name: services.name })
            .from(services)
            .where(inArray(services.id, incident.servicesAffected));
          affectedServices = svcResults;
        }

        return {
          ...incident,
          updates,
          affectedServices,
        };
      }),
    );

    return NextResponse.json({ incidents: incidentsWithUpdates });
  } catch (error) {
    console.error("[API] Failed to fetch incidents:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch incidents",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/incidents
 * Create a new incident
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const { orgId, title, message, severity, servicesAffected } = body;

    if (!orgId || !title || !message) {
      return NextResponse.json(
        { error: "orgId, title, and message are required" },
        { status: 400 },
      );
    }

    // Verify user has admin/agent role
    // Note: Internal users (ADMIN, AGENT) bypass role check automatically
    const { user: orgUser } = await requireOrgRole(orgId, ["CUSTOMER_ADMIN"]);
    if (!orgUser) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const [incident] = await db
      .insert(incidents)
      .values({
        orgId,
        title,
        message,
        severity: severity || "minor",
        status: "investigating",
        servicesAffected: servicesAffected || [],
        createdBy: orgUser.id,
      })
      .returning();

    // Create initial update
    await db.insert(incidentUpdates).values({
      incidentId: incident.id,
      status: "investigating",
      message: "Incident created and under investigation",
      createdBy: orgUser.id,
    });

    return NextResponse.json({ incident }, { status: 201 });
  } catch (error) {
    console.error("[API] Failed to create incident:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create incident",
      },
      { status: 500 },
    );
  }
}
