import { eq, and, desc, isNull, gte, lte, sql, count, avg } from 'drizzle-orm';
import { db } from '@/db';
import { csatSurveys, csatAnalytics, tickets, organizations } from '@/db/schema';
import { createHash, randomBytes } from 'crypto';

export interface CreateCSATInput {
  ticketId: string;
  orgId: string;
  requesterId?: string | null;
}

export interface SubmitCSATInput {
  tokenHash: string;
  rating: number;
  comment?: string;
}

/**
 * Generate a secure token for CSAT survey
 */
export function generateCSATToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

/**
 * Create a new CSAT survey for a resolved ticket
 */
export async function createCSATSurvey(input: CreateCSATInput) {
  const { token, hash } = generateCSATToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days to respond

  const [survey] = await db
    .insert(csatSurveys)
    .values({
      ticketId: input.ticketId,
      orgId: input.orgId,
      requesterId: input.requesterId,
      tokenHash: hash,
      expiresAt,
    })
    .returning();

  return { survey, token };
}

/**
 * Submit a CSAT response
 */
export async function submitCSATResponse(input: SubmitCSATInput) {
  const [survey] = await db
    .update(csatSurveys)
    .set({
      rating: input.rating,
      comment: input.comment,
      respondedAt: new Date(),
    })
    .where(
      and(
        eq(csatSurveys.tokenHash, input.tokenHash),
        isNull(csatSurveys.respondedAt),
        gte(csatSurveys.expiresAt, new Date())
      )
    )
    .returning();

  if (survey) {
    // Update analytics asynchronously
    await updateCSATAnalytics(survey.orgId);
  }

  return survey;
}

/**
 * Get CSAT survey by token hash
 */
export async function getCSATByToken(tokenHash: string) {
  const [survey] = await db
    .select()
    .from(csatSurveys)
    .where(eq(csatSurveys.tokenHash, tokenHash));

  return survey;
}

/**
 * Get CSAT surveys for an organization
 */
export async function getOrgCSATSurveys(
  orgId: string,
  options: {
    responded?: boolean;
    limit?: number;
    offset?: number;
  } = {}
) {
  const { responded, limit = 50, offset = 0 } = options;

  const conditions = [eq(csatSurveys.orgId, orgId)];

  if (responded === true) {
    conditions.push(sql`${csatSurveys.respondedAt} IS NOT NULL`);
  } else if (responded === false) {
    conditions.push(isNull(csatSurveys.respondedAt));
  }

  const surveys = await db
    .select({
      survey: csatSurveys,
      ticket: {
        key: tickets.key,
        subject: tickets.subject,
      },
    })
    .from(csatSurveys)
    .leftJoin(tickets, eq(csatSurveys.ticketId, tickets.id))
    .where(and(...conditions))
    .orderBy(desc(csatSurveys.createdAt))
    .limit(limit)
    .offset(offset);

  return surveys;
}

/**
 * Update CSAT analytics for an organization
 */
export async function updateCSATAnalytics(orgId: string) {
  // Calculate stats
  const stats = await db
    .select({
      totalSent: count(),
      totalResponses: count(sql`CASE WHEN ${csatSurveys.respondedAt} IS NOT NULL THEN 1 END`),
      avgRating: avg(csatSurveys.rating),
      rating1: count(sql`CASE WHEN ${csatSurveys.rating} = 1 THEN 1 END`),
      rating2: count(sql`CASE WHEN ${csatSurveys.rating} = 2 THEN 1 END`),
      rating3: count(sql`CASE WHEN ${csatSurveys.rating} = 3 THEN 1 END`),
      rating4: count(sql`CASE WHEN ${csatSurveys.rating} = 4 THEN 1 END`),
      rating5: count(sql`CASE WHEN ${csatSurveys.rating} = 5 THEN 1 END`),
    })
    .from(csatSurveys)
    .where(eq(csatSurveys.orgId, orgId));

  const s = stats[0];
  const responseRate = s.totalSent > 0 
    ? Number(((Number(s.totalResponses) / Number(s.totalSent)) * 100).toFixed(2))
    : 0;

  // Last 30 days avg
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const last30Days = await db
    .select({ avg: avg(csatSurveys.rating) })
    .from(csatSurveys)
    .where(
      and(
        eq(csatSurveys.orgId, orgId),
        gte(csatSurveys.respondedAt, thirtyDaysAgo)
      )
    );

  await db
    .insert(csatAnalytics)
    .values({
      orgId,
      totalSent: Number(s.totalSent),
      totalResponses: Number(s.totalResponses),
      averageRating: s.avgRating ? String(Number(s.avgRating).toFixed(2)) : null,
      rating1Count: Number(s.rating1),
      rating2Count: Number(s.rating2),
      rating3Count: Number(s.rating3),
      rating4Count: Number(s.rating4),
      rating5Count: Number(s.rating5),
      last30DaysAvg: last30Days[0]?.avg ? String(Number(last30Days[0].avg).toFixed(2)) : null,
      responseRate: String(responseRate.toFixed(2)),
    })
    .onConflictDoUpdate({
      target: csatAnalytics.orgId,
      set: {
        totalSent: Number(s.totalSent),
        totalResponses: Number(s.totalResponses),
        averageRating: s.avgRating ? String(Number(s.avgRating).toFixed(2)) : null,
        rating1Count: Number(s.rating1),
        rating2Count: Number(s.rating2),
        rating3Count: Number(s.rating3),
        rating4Count: Number(s.rating4),
        rating5Count: Number(s.rating5),
        last30DaysAvg: last30Days[0]?.avg ? String(Number(last30Days[0].avg).toFixed(2)) : null,
        responseRate: String(responseRate.toFixed(2)),
        updatedAt: new Date(),
      },
    });
}

/**
 * Get CSAT analytics for an organization
 */
export async function getCSATAnalytics(orgId: string) {
  const [analytics] = await db
    .select()
    .from(csatAnalytics)
    .where(eq(csatAnalytics.orgId, orgId));

  return analytics;
}

/**
 * Send CSAT reminders for pending surveys
 */
export async function sendCSATReminders(maxReminders = 2) {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const pendingSurveys = await db
    .select({
      survey: csatSurveys,
      org: {
        subdomain: organizations.subdomain,
      },
    })
    .from(csatSurveys)
    .innerJoin(organizations, eq(csatSurveys.orgId, organizations.id))
    .where(
      and(
        isNull(csatSurveys.respondedAt),
        gte(csatSurveys.expiresAt, new Date()),
        lte(csatSurveys.sentAt, threeDaysAgo),
        lte(csatSurveys.reminderCount, maxReminders),
        sql`(${csatSurveys.lastReminderAt} IS NULL OR ${csatSurveys.lastReminderAt} < ${threeDaysAgo})`
      )
    );

  return pendingSurveys;
}

/**
 * Increment reminder count
 */
export async function incrementReminderCount(surveyId: string) {
  await db
    .update(csatSurveys)
    .set({
      reminderCount: sql`${csatSurveys.reminderCount} + 1`,
      lastReminderAt: new Date(),
    })
    .where(eq(csatSurveys.id, surveyId));
}
