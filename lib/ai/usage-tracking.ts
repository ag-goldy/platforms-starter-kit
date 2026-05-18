/**
 * AI Usage Tracking & Cost Calculation
 *
 * Tracks token usage and estimates costs for AI queries
 * Provides quota enforcement per organization
 */

import { db } from "@/db";
import { aiUsage, orgAIConfigs } from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

// Cost per 1K tokens in USD
const COST_PER_1K_TOKENS: Record<
  string,
  { prompt: number; completion: number }
> = {
  "openai/gpt-oss-120b": { prompt: 0.0005, completion: 0.0015 },
  "deepseek-ai/DeepSeek-V3.1": { prompt: 0.0003, completion: 0.001 },
  "gpt-4o-mini": { prompt: 0.00015, completion: 0.0006 },
};

interface UsageData {
  promptTokens: number;
  completionTokens: number;
  modelUsed: string;
}

interface QuotaStatus {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  percentage: number;
  isWarning: boolean;
}

/**
 * Calculate estimated cost for a query
 */
export function calculateCost(modelUsed: string, usage: UsageData): number {
  const costs =
    COST_PER_1K_TOKENS[modelUsed] ||
    COST_PER_1K_TOKENS["deepseek-ai/DeepSeek-V3.1"];

  const promptCost = (usage.promptTokens / 1000) * costs.prompt;
  const completionCost = (usage.completionTokens / 1000) * costs.completion;

  return parseFloat((promptCost + completionCost).toFixed(6));
}

/**
 * Log AI usage to database
 */
export async function logAIUsage({
  orgId,
  userId,
  interface: interfaceType,
  modelUsed,
  promptTokens,
  completionTokens,
  metadata = {},
}: {
  orgId: string;
  userId?: string;
  interface: "public" | "customer" | "admin";
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const totalTokens = promptTokens + completionTokens;
    const estimatedCost = calculateCost(modelUsed, {
      promptTokens,
      completionTokens,
      modelUsed,
    });

    await db.insert(aiUsage).values({
      orgId,
      userId: userId || null,
      interface: interfaceType,
      modelUsed,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost: estimatedCost.toString(),
      metadata,
    });
  } catch (error) {
    console.error("[AI Usage] Failed to log usage:", error);
    // Don't throw - logging failures shouldn't break AI functionality
  }
}

/**
 * Get current month's AI usage for an organization
 */
export async function getMonthlyAIUsage(orgId: string): Promise<{
  totalQueries: number;
  totalTokens: number;
  totalCost: number;
}> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await db
    .select({
      totalQueries: sql<number>`COUNT(*)`,
      totalTokens: sql<number>`SUM(${aiUsage.totalTokens})`,
      totalCost: sql<number>`SUM(${aiUsage.estimatedCost})`,
    })
    .from(aiUsage)
    .where(and(eq(aiUsage.orgId, orgId), gte(aiUsage.createdAt, startOfMonth)));

  return {
    totalQueries: Number(result[0]?.totalQueries || 0),
    totalTokens: Number(result[0]?.totalTokens || 0),
    totalCost: parseFloat(result[0]?.totalCost?.toString() || "0"),
  };
}

/**
 * Check if organization has exceeded their AI usage quota
 */
export async function checkAIQuota(orgId: string): Promise<QuotaStatus> {
  try {
    // Get org's AI config
    const config = await db.query.orgAIConfigs.findFirst({
      where: eq(orgAIConfigs.orgId, orgId),
    });

    const limit = config?.customerRateLimit || 100; // Default 100 queries/month

    // Get current usage
    const usage = await getMonthlyAIUsage(orgId);

    // For rate limit, we count queries, not tokens
    const currentUsage = usage.totalQueries;
    const percentage = (currentUsage / limit) * 100;

    return {
      allowed: currentUsage < limit,
      currentUsage,
      limit,
      percentage,
      isWarning: percentage >= 80 && percentage < 100,
    };
  } catch (error) {
    console.error("[AI Quota] Failed to check quota:", error);
    // Default to allowing if check fails
    return {
      allowed: true,
      currentUsage: 0,
      limit: 100,
      percentage: 0,
      isWarning: false,
    };
  }
}

/**
 * Get detailed AI usage breakdown by interface and model
 */
export async function getAIUsageBreakdown(
  orgId: string,
  days = 30,
): Promise<{
  byInterface: Record<
    string,
    { queries: number; tokens: number; cost: number }
  >;
  byModel: Record<string, { queries: number; tokens: number; cost: number }>;
  daily: Array<{ date: string; queries: number; tokens: number; cost: number }>;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get all usage records
  const usage = await db
    .select({
      interface: aiUsage.interface,
      modelUsed: aiUsage.modelUsed,
      totalTokens: aiUsage.totalTokens,
      estimatedCost: aiUsage.estimatedCost,
      createdAt: aiUsage.createdAt,
    })
    .from(aiUsage)
    .where(and(eq(aiUsage.orgId, orgId), gte(aiUsage.createdAt, startDate)));

  // Aggregate by interface
  const byInterface: Record<
    string,
    { queries: number; tokens: number; cost: number }
  > = {};
  const byModel: Record<
    string,
    { queries: number; tokens: number; cost: number }
  > = {};
  const dailyMap: Record<
    string,
    { queries: number; tokens: number; cost: number }
  > = {};

  for (const record of usage) {
    // By interface
    if (!byInterface[record.interface]) {
      byInterface[record.interface] = { queries: 0, tokens: 0, cost: 0 };
    }
    byInterface[record.interface].queries++;
    byInterface[record.interface].tokens += Number(record.totalTokens);
    byInterface[record.interface].cost += parseFloat(
      record.estimatedCost?.toString() || "0",
    );

    // By model
    if (!byModel[record.modelUsed]) {
      byModel[record.modelUsed] = { queries: 0, tokens: 0, cost: 0 };
    }
    byModel[record.modelUsed].queries++;
    byModel[record.modelUsed].tokens += Number(record.totalTokens);
    byModel[record.modelUsed].cost += parseFloat(
      record.estimatedCost?.toString() || "0",
    );

    // Daily
    const date = record.createdAt.toISOString().split("T")[0];
    if (!dailyMap[date]) {
      dailyMap[date] = { queries: 0, tokens: 0, cost: 0 };
    }
    dailyMap[date].queries++;
    dailyMap[date].tokens += Number(record.totalTokens);
    dailyMap[date].cost += parseFloat(record.estimatedCost?.toString() || "0");
  }

  // Convert daily map to sorted array
  const daily = Object.entries(dailyMap)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { byInterface, byModel, daily };
}
