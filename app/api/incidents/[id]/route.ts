import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { incidents, incidentUpdates, services } from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/session';
import { requireOrgRole } from '@/lib/auth/permissions';

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/incidents/[id]
 * Get a specific incident with updates
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
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    // Verify user has access to this org
    // Note: Internal users (ADMIN, AGENT) bypass role check automatically
    await requireOrgRole(incident.orgId, ['CUSTOMER_ADMIN']);

    // Get updates
    const updates = await db
      .select()
      .from(incidentUpdates)
      .where(eq(incidentUpdates.incidentId, incidentId))
      .orderBy(desc(incidentUpdates.createdAt));

    // Get affected services
    let affectedServices: { id: string; name: string }[] = [];
    if (incident.servicesAffected && incident.servicesAffected.length > 0) {
      const svcResults = await db
        .select({ id: services.id, name: services.name })
        .from(services)
        .where(inArray(services.id, incident.servicesAffected));
      affectedServices = svcResults;
    }

    return NextResponse.json({
      incident: {
        ...incident,
        updates,
        affectedServices,
      },
    });
  } catch (error) {
    console.error('[API] Failed to fetch incident:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch incident' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/incidents/[id]
 * Update an incident (status, title, message)
 */
export async function PUT(request: NextRequest, { params }: Params) {
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
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    // Verify user has admin/agent role
    // Note: Internal users (ADMIN, AGENT) bypass role check automatically
    await requireOrgRole(incident.orgId, ['CUSTOMER_ADMIN']);

    const body = await request.json();
    const { status, title, message, severity, servicesAffected } = body;

    const updates: Partial<typeof incidents.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (status !== undefined) updates.status = status;
    if (title !== undefined) updates.title = title;
    if (message !== undefined) updates.message = message;
    if (severity !== undefined) updates.severity = severity;
    if (servicesAffected !== undefined) updates.servicesAffected = servicesAffected;

    // If status changed to resolved, set resolvedAt
    if (status === 'resolved' && incident.status !== 'resolved') {
      updates.resolvedAt = new Date();
    }

    const [updated] = await db
      .update(incidents)
      .set(updates)
      .where(eq(incidents.id, incidentId))
      .returning();

    return NextResponse.json({ incident: updated });
  } catch (error) {
    console.error('[API] Failed to update incident:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update incident' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/incidents/[id]
 * Delete an incident (admin only)
 */
export async function DELETE(request: NextRequest, { params }: Params) {
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
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    // Verify user has admin role
    // Note: Internal users (ADMIN, AGENT) bypass role check automatically
    await requireOrgRole(incident.orgId, ['CUSTOMER_ADMIN']);

    await db.delete(incidents).where(eq(incidents.id, incidentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Failed to delete incident:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete incident' },
      { status: 500 }
    );
  }
}
