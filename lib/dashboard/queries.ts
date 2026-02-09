import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { dashboardWidgets, widgetTypeEnum } from '@/db/schema';

export type WidgetType = typeof widgetTypeEnum.enumValues[number];

export interface CreateWidgetInput {
  userId: string;
  orgId?: string;
  type: string;
  title?: string;
  config?: Record<string, unknown>;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  refreshIntervalSeconds?: number;
}

export interface UpdateWidgetInput {
  title?: string;
  config?: Record<string, unknown>;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  refreshIntervalSeconds?: number;
  isVisible?: boolean;
}

/**
 * Get all widgets for a user
 */
export async function getUserWidgets(userId: string, orgId?: string) {
  const conditions = [eq(dashboardWidgets.userId, userId), eq(dashboardWidgets.isVisible, true)];

  if (orgId) {
    conditions.push(
      sql`(${dashboardWidgets.orgId} IS NULL OR ${dashboardWidgets.orgId} = ${orgId})`
    );
  }

  return await db
    .select()
    .from(dashboardWidgets)
    .where(and(...conditions))
    .orderBy(dashboardWidgets.positionY, dashboardWidgets.positionX);
}

/**
 * Get widget by ID
 */
export async function getWidgetById(id: string) {
  const [widget] = await db
    .select()
    .from(dashboardWidgets)
    .where(eq(dashboardWidgets.id, id));

  return widget;
}

/**
 * Create a new dashboard widget
 */
export async function createWidget(input: CreateWidgetInput) {
  const [widget] = await db
    .insert(dashboardWidgets)
    .values({
      userId: input.userId,
      orgId: input.orgId,
      type: input.type as WidgetType,
      title: input.title,
      config: input.config || {},
      positionX: input.positionX || 0,
      positionY: input.positionY || 0,
      width: input.width || 2,
      height: input.height || 2,
      refreshIntervalSeconds: input.refreshIntervalSeconds || 300,
    })
    .returning();

  return widget;
}

/**
 * Update a widget
 */
export async function updateWidget(id: string, input: UpdateWidgetInput) {
  const [widget] = await db
    .update(dashboardWidgets)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(dashboardWidgets.id, id))
    .returning();

  return widget;
}

/**
 * Delete a widget
 */
export async function deleteWidget(id: string, userId: string) {
  const result = await db
    .delete(dashboardWidgets)
    .where(and(eq(dashboardWidgets.id, id), eq(dashboardWidgets.userId, userId)))
    .returning();

  return result.length > 0;
}

/**
 * Update widget positions (for drag-and-drop reordering)
 */
export async function updateWidgetPositions(
  updates: Array<{ id: string; positionX: number; positionY: number }>
) {
  for (const update of updates) {
    await db
      .update(dashboardWidgets)
      .set({
        positionX: update.positionX,
        positionY: update.positionY,
        updatedAt: new Date(),
      })
      .where(eq(dashboardWidgets.id, update.id));
  }
}

/**
 * Create default widgets for a new user
 */
export async function createDefaultWidgets(userId: string, orgId?: string) {
  const defaults = [
    {
      type: 'ticket_count',
      title: 'Ticket Overview',
      positionX: 0,
      positionY: 0,
      width: 2,
      height: 2,
    },
    {
      type: 'assigned_to_me',
      title: 'My Tickets',
      positionX: 2,
      positionY: 0,
      width: 2,
      height: 2,
    },
    {
      type: 'sla_compliance',
      title: 'SLA Compliance',
      positionX: 0,
      positionY: 2,
      width: 2,
      height: 2,
    },
    {
      type: 'recent_tickets',
      title: 'Recent Activity',
      positionX: 2,
      positionY: 2,
      width: 2,
      height: 2,
    },
  ];

  const widgets = [];
  for (const def of defaults) {
    const [widget] = await db
      .insert(dashboardWidgets)
      .values({
        userId,
        orgId,
        type: def.type as WidgetType,
        title: def.title,
        positionX: def.positionX,
        positionY: def.positionY,
        width: def.width,
        height: def.height,
      })
      .returning();
    widgets.push(widget);
  }

  return widgets;
}

/**
 * Get widget data - ticket count
 */
export async function getTicketCountWidgetData(orgId?: string) {
  const conditions = orgId ? sql`org_id = ${orgId}` : sql`TRUE`;

  const result = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'NEW') as new,
      COUNT(*) FILTER (WHERE status = 'OPEN') as open,
      COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress,
      COUNT(*) FILTER (WHERE status = 'WAITING_ON_CUSTOMER') as waiting,
      COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved,
      COUNT(*) FILTER (WHERE status = 'CLOSED') as closed
    FROM tickets
    WHERE ${conditions}
  `);

  return result[0];
}

/**
 * Get widget data - SLA compliance
 */
export async function getSLAComplianceWidgetData(orgId?: string) {
  const conditions = orgId ? sql`org_id = ${orgId}` : sql`TRUE`;

  const result = await db.execute(sql`
    SELECT 
      COUNT(*) as total_tickets,
      COUNT(*) FILTER (WHERE first_response_at IS NOT NULL AND first_response_at <= (created_at + INTERVAL '1 hour' * COALESCE(sla_response_target_hours, 4))) as met_response,
      COUNT(*) FILTER (WHERE resolved_at IS NOT NULL AND resolved_at <= (created_at + INTERVAL '1 hour' * COALESCE(sla_resolution_target_hours, 24))) as met_resolution
    FROM tickets
    WHERE ${conditions}
      AND created_at >= NOW() - INTERVAL '30 days'
  `);

  const data = result[0];
  const total = Number(data?.total_tickets || 0);

  return {
    total,
    metResponse: Number(data?.met_response || 0),
    metResolution: Number(data?.met_resolution || 0),
    responseCompliance: total > 0 ? Math.round((Number(data?.met_response || 0) / total) * 100) : 100,
    resolutionCompliance: total > 0 ? Math.round((Number(data?.met_resolution || 0) / total) * 100) : 100,
  };
}

/**
 * Get widget data - assigned to me
 */
export async function getAssignedToMeWidgetData(userId: string) {
  const result = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status IN ('NEW', 'OPEN', 'IN_PROGRESS')) as active,
      COUNT(*) FILTER (WHERE priority = 'P1') as p1_count,
      COUNT(*) FILTER (WHERE priority = 'P2') as p2_count
    FROM tickets
    WHERE assignee_id = ${userId}
      AND status NOT IN ('CLOSED')
  `);

  return result[0];
}

/**
 * Get widget data - unassigned tickets
 */
export async function getUnassignedTicketsWidgetData(orgId?: string) {
  const conditions = orgId ? sql`AND org_id = ${orgId}` : sql``;

  const result = await db.execute(sql`
    SELECT 
      COUNT(*) as count,
      COUNT(*) FILTER (WHERE priority = 'P1') as p1_count,
      COUNT(*) FILTER (WHERE priority = 'P2') as p2_count,
      COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '24 hours') as stale_count
    FROM tickets
    WHERE assignee_id IS NULL
      AND status NOT IN ('RESOLVED', 'CLOSED')
      ${conditions}
  `);

  return result[0];
}

/**
 * Get widget data - priority breakdown
 */
export async function getPriorityBreakdownWidgetData(orgId?: string) {
  const conditions = orgId ? sql`WHERE org_id = ${orgId}` : sql``;

  const result = await db.execute(sql`
    SELECT 
      priority,
      COUNT(*) as count
    FROM tickets
    ${conditions}
    GROUP BY priority
    ORDER BY 
      CASE priority 
        WHEN 'P1' THEN 1 
        WHEN 'P2' THEN 2 
        WHEN 'P3' THEN 3 
        WHEN 'P4' THEN 4 
      END
  `);

  return result;
}

/**
 * Get widget data - recent activity
 */
export async function getRecentActivityWidgetData(orgId?: string, limit = 10) {
  const conditions = orgId ? sql`AND t.org_id = ${orgId}` : sql``;

  const result = await db.execute(sql`
    SELECT 
      t.id,
      t.key,
      t.subject,
      t.status,
      t.priority,
      t.updated_at,
      u.name as updater_name
    FROM tickets t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.updated_at >= NOW() - INTERVAL '7 days'
      ${conditions}
    ORDER BY t.updated_at DESC
    LIMIT ${limit}
  `);

  return result;
}

/**
 * Reset user dashboard to defaults
 */
export async function resetDashboard(userId: string, orgId?: string) {
  // Delete existing widgets
  await db
    .delete(dashboardWidgets)
    .where(eq(dashboardWidgets.userId, userId));

  // Create defaults
  return await createDefaultWidgets(userId, orgId);
}
