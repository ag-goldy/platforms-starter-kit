import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, users, organizations, ticketComments } from "@/db/schema";
import { eq, and, gte, lte, sql, count, avg, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { requireOrgRole } from "@/lib/auth/permissions";

/**
 * GET /api/reports?type=xxx&orgId=xxx&start=xxx&end=xxx
 * Get report data
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const type = searchParams.get("type");
    const orgId = searchParams.get("orgId");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!type || !orgId) {
      return NextResponse.json(
        { error: "Report type and organization ID are required" },
        { status: 400 },
      );
    }

    // Verify access
    await requireOrgRole(orgId, ["ADMIN", "AGENT"]);

    const startDate = start
      ? new Date(start)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = end ? new Date(end) : new Date();

    switch (type) {
      case "ticket-volume":
        return await getTicketVolumeReport(orgId, startDate, endDate);
      case "agent-performance":
        return await getAgentPerformanceReport(orgId, startDate, endDate);
      case "sla-compliance":
        return await getSLAComplianceReport(orgId, startDate, endDate);
      case "category-distribution":
        return await getCategoryDistributionReport(orgId, startDate, endDate);
      case "response-time":
        return await getResponseTimeReport(orgId, startDate, endDate);
      case "resolution-time":
        return await getResolutionTimeReport(orgId, startDate, endDate);
      case "top-requesters":
        return await getTopRequestersReport(orgId, startDate, endDate);
      default:
        return NextResponse.json(
          { error: "Invalid report type" },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("[API] Failed to generate report:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate report",
      },
      { status: 500 },
    );
  }
}

/**
 * Ticket Volume Report - tickets per day
 */
async function getTicketVolumeReport(
  orgId: string,
  startDate: Date,
  endDate: Date,
) {
  const results = await db
    .select({
      date: sql<string>`DATE(${tickets.createdAt})`,
      count: count(),
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.orgId, orgId),
        gte(tickets.createdAt, startDate),
        lte(tickets.createdAt, endDate),
      ),
    )
    .groupBy(sql`DATE(${tickets.createdAt})`)
    .orderBy(sql`DATE(${tickets.createdAt})`);

  // Fill in missing dates with 0
  const data: { date: string; count: number }[] = [];
  const dateMap = new Map(results.map((r) => [r.date, Number(r.count)]));

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    data.push({ date: dateStr, count: dateMap.get(dateStr) || 0 });
  }

  return NextResponse.json({ data });
}

/**
 * Agent Performance Report
 */
async function getAgentPerformanceReport(
  orgId: string,
  startDate: Date,
  endDate: Date,
) {
  // Get all tickets with assignees
  const results = await db
    .select({
      assigneeId: tickets.assigneeId,
      assigneeName: users.name,
      assigneeEmail: users.email,
      totalTickets: count(),
      resolvedTickets: sql<number>`COUNT(CASE WHEN ${tickets.status} IN ('RESOLVED', 'CLOSED') THEN 1 END)`,
    })
    .from(tickets)
    .leftJoin(users, eq(tickets.assigneeId, users.id))
    .where(
      and(
        eq(tickets.orgId, orgId),
        gte(tickets.createdAt, startDate),
        lte(tickets.createdAt, endDate),
        sql`${tickets.assigneeId} IS NOT NULL`,
      ),
    )
    .groupBy(tickets.assigneeId, users.name, users.email);

  return NextResponse.json({
    data: results.map((r) => ({
      agentId: r.assigneeId,
      agentName: r.assigneeName || r.assigneeEmail || "Unknown",
      totalTickets: Number(r.totalTickets),
      resolvedTickets: Number(r.resolvedTickets),
    })),
  });
}

/**
 * SLA Compliance Report
 */
async function getSLAComplianceReport(
  orgId: string,
  startDate: Date,
  endDate: Date,
) {
  const results = await db
    .select({
      priority: tickets.priority,
      total: count(),
      // Check if first response was made within target hours
      metResponse: sql<number>`COUNT(CASE WHEN ${tickets.slaResponseTargetHours} IS NOT NULL AND ${tickets.firstResponseAt} IS NOT NULL THEN 1 END)`,
      // Check if resolution was made within target hours
      metResolution: sql<number>`COUNT(CASE WHEN ${tickets.slaResolutionTargetHours} IS NOT NULL AND ${tickets.resolvedAt} IS NOT NULL THEN 1 END)`,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.orgId, orgId),
        gte(tickets.createdAt, startDate),
        lte(tickets.createdAt, endDate),
      ),
    )
    .groupBy(tickets.priority);

  return NextResponse.json({
    data: results.map((r) => ({
      priority: r.priority,
      total: Number(r.total),
      responseCompliance:
        r.total > 0
          ? Math.round((Number(r.metResponse) / Number(r.total)) * 100)
          : 100,
      resolutionCompliance:
        r.total > 0
          ? Math.round((Number(r.metResolution) / Number(r.total)) * 100)
          : 100,
    })),
  });
}

/**
 * Category Distribution Report
 */
async function getCategoryDistributionReport(
  orgId: string,
  startDate: Date,
  endDate: Date,
) {
  const results = await db
    .select({
      category: tickets.category,
      count: count(),
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.orgId, orgId),
        gte(tickets.createdAt, startDate),
        lte(tickets.createdAt, endDate),
      ),
    )
    .groupBy(tickets.category);

  return NextResponse.json({
    data: results.map((r) => ({
      category: r.category,
      count: Number(r.count),
    })),
  });
}

/**
 * Response Time Report - average first response time
 */
async function getResponseTimeReport(
  orgId: string,
  startDate: Date,
  endDate: Date,
) {
  const results = await db
    .select({
      date: sql<string>`DATE(${tickets.createdAt})`,
      avgResponseHours: sql<number>`AVG(EXTRACT(EPOCH FROM (${tickets.firstResponseAt} - ${tickets.createdAt})) / 3600)`,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.orgId, orgId),
        gte(tickets.createdAt, startDate),
        lte(tickets.createdAt, endDate),
        sql`${tickets.firstResponseAt} IS NOT NULL`,
      ),
    )
    .groupBy(sql`DATE(${tickets.createdAt})`)
    .orderBy(sql`DATE(${tickets.createdAt})`);

  return NextResponse.json({
    data: results.map((r) => ({
      date: r.date,
      avgHours: Math.round(Number(r.avgResponseHours) * 10) / 10,
    })),
  });
}

/**
 * Resolution Time Report - average resolution time
 */
async function getResolutionTimeReport(
  orgId: string,
  startDate: Date,
  endDate: Date,
) {
  const results = await db
    .select({
      date: sql<string>`DATE(${tickets.createdAt})`,
      avgResolutionHours: sql<number>`AVG(EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 3600)`,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.orgId, orgId),
        gte(tickets.createdAt, startDate),
        lte(tickets.createdAt, endDate),
        sql`${tickets.resolvedAt} IS NOT NULL`,
      ),
    )
    .groupBy(sql`DATE(${tickets.createdAt})`)
    .orderBy(sql`DATE(${tickets.createdAt})`);

  return NextResponse.json({
    data: results.map((r) => ({
      date: r.date,
      avgHours: Math.round(Number(r.avgResolutionHours) * 10) / 10,
    })),
  });
}

/**
 * Top Requesters Report
 */
async function getTopRequestersReport(
  orgId: string,
  startDate: Date,
  endDate: Date,
) {
  const results = await db
    .select({
      requesterEmail: tickets.requesterEmail,
      count: count(),
      topCategory: sql<string>`MODE() WITHIN GROUP (ORDER BY ${tickets.category})`,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.orgId, orgId),
        gte(tickets.createdAt, startDate),
        lte(tickets.createdAt, endDate),
        sql`${tickets.requesterEmail} IS NOT NULL`,
      ),
    )
    .groupBy(tickets.requesterEmail)
    .orderBy(desc(count()))
    .limit(20);

  return NextResponse.json({
    data: results.map((r) => ({
      email: r.requesterEmail,
      ticketCount: Number(r.count),
      topCategory: r.topCategory,
    })),
  });
}
