import { eq, and, desc, sql, count } from 'drizzle-orm';
import { db } from '@/db';
import { webhooks, webhookDeliveries, webhookEventEnum, webhookStatusEnum } from '@/db/schema';
import { createHmac, randomBytes } from 'crypto';

export type WebhookEvent = typeof webhookEventEnum.enumValues[number];
export type WebhookStatus = typeof webhookStatusEnum.enumValues[number];

export interface CreateWebhookInput {
  orgId: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  filterConditions?: Record<string, unknown>;
  customHeaders?: Record<string, string>;
  maxRetries?: number;
  createdBy?: string;
}

export interface UpdateWebhookInput {
  name?: string;
  url?: string;
  events?: WebhookEvent[];
  secret?: string;
  filterConditions?: Record<string, unknown>;
  customHeaders?: Record<string, string>;
  maxRetries?: number;
  status?: WebhookStatus;
}

/**
 * Generate a webhook secret
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Create a new webhook
 */
export async function createWebhook(input: CreateWebhookInput) {
  const secret = input.secret || generateWebhookSecret();

  const [webhook] = await db
    .insert(webhooks)
    .values({
      orgId: input.orgId,
      name: input.name,
      url: input.url,
      events: input.events as WebhookEvent[],
      secret,
      filterConditions: input.filterConditions || {},
      customHeaders: input.customHeaders || {},
      maxRetries: input.maxRetries || 3,
      createdBy: input.createdBy,
    })
    .returning();

  return { webhook, secret };
}

/**
 * Update a webhook
 */
export async function updateWebhook(webhookId: string, input: UpdateWebhookInput) {
  const [webhook] = await db
    .update(webhooks)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(webhooks.id, webhookId))
    .returning();

  return webhook;
}

/**
 * Delete a webhook
 */
export async function deleteWebhook(webhookId: string, orgId: string) {
  const result = await db
    .delete(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.orgId, orgId)))
    .returning();

  return result.length > 0;
}

/**
 * Get webhook by ID
 */
export async function getWebhookById(webhookId: string) {
  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, webhookId));

  return webhook;
}

/**
 * Get webhooks for an organization
 */
export async function getOrgWebhooks(orgId: string, options: { status?: string } = {}) {
  const conditions = [eq(webhooks.orgId, orgId)];

  if (options.status) {
    conditions.push(eq(webhooks.status, options.status as WebhookStatus));
  }

  return await db
    .select()
    .from(webhooks)
    .where(and(...conditions))
    .orderBy(desc(webhooks.createdAt));
}

/**
 * Get active webhooks for an event
 */
export async function getWebhooksForEvent(orgId: string, event: string) {
  return await db
    .select()
    .from(webhooks)
    .where(
      and(
        eq(webhooks.orgId, orgId),
        eq(webhooks.status, 'active'),
        sql`${webhooks.events} @> ARRAY[${event}]::webhook_event[]`
      )
    );
}

/**
 * Sign webhook payload
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Record a webhook delivery attempt
 */
export async function recordWebhookDelivery(input: {
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseStatus?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  durationMs?: number;
  success: boolean;
  errorMessage?: string;
  retryNumber?: number;
  willRetry?: boolean;
  nextRetryAt?: Date;
}) {
  const [delivery] = await db
    .insert(webhookDeliveries)
    .values({
      webhookId: input.webhookId,
      event: input.event as WebhookEvent,
      payload: input.payload,
      requestHeaders: input.requestHeaders,
      requestBody: input.requestBody,
      responseStatus: input.responseStatus,
      responseBody: input.responseBody,
      responseHeaders: input.responseHeaders,
      durationMs: input.durationMs,
      success: input.success,
      errorMessage: input.errorMessage,
      retryNumber: input.retryNumber || 0,
      willRetry: input.willRetry || false,
      nextRetryAt: input.nextRetryAt,
    })
    .returning();

  // Update webhook stats
  await db
    .update(webhooks)
    .set({
      totalDeliveries: sql`${webhooks.totalDeliveries} + 1`,
      totalFailures: input.success 
        ? webhooks.totalFailures 
        : sql`${webhooks.totalFailures} + 1`,
      lastSuccessAt: input.success ? new Date() : webhooks.lastSuccessAt,
      lastError: input.success ? null : input.errorMessage,
      lastErrorAt: input.success ? null : new Date(),
      retryCount: !input.success && input.willRetry 
        ? sql`${webhooks.retryCount} + 1` 
        : 0,
      status: !input.success && !input.willRetry 
        ? 'failing' 
        : webhooks.status,
    })
    .where(eq(webhooks.id, input.webhookId));

  return delivery;
}

/**
 * Get webhook delivery history
 */
export async function getWebhookDeliveries(
  webhookId: string,
  options: {
    limit?: number;
    offset?: number;
    success?: boolean;
  } = {}
) {
  const { limit = 50, offset = 0, success } = options;

  const conditions = [eq(webhookDeliveries.webhookId, webhookId)];

  if (success !== undefined) {
    conditions.push(eq(webhookDeliveries.success, success));
  }

  return await db
    .select()
    .from(webhookDeliveries)
    .where(and(...conditions))
    .orderBy(desc(webhookDeliveries.attemptedAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get pending retries
 */
export async function getPendingRetries() {
  return await db
    .select()
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.success, false),
        eq(webhookDeliveries.willRetry, true),
        sql`${webhookDeliveries.nextRetryAt} <= NOW()`
      )
    )
    .orderBy(webhookDeliveries.nextRetryAt);
}

/**
 * Test a webhook with a sample payload
 */
export async function testWebhook(webhookId: string) {
  const webhook = await getWebhookById(webhookId);
  if (!webhook) return null;

  const samplePayload = {
    event: 'ticket.created',
    timestamp: new Date().toISOString(),
    data: {
      ticket: {
        id: 'test-ticket-id',
        key: 'TEST-001',
        subject: 'Test Webhook',
        status: 'NEW',
        priority: 'P3',
      },
    },
  };

  const payloadString = JSON.stringify(samplePayload);
  const signature = webhook.secret 
    ? signWebhookPayload(payloadString, webhook.secret)
    : undefined;

  const startTime = Date.now();

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': 'ticket.created',
        'X-Webhook-Signature': signature || '',
        ...(webhook.customHeaders || {}),
      },
      body: payloadString,
    });

    const durationMs = Date.now() - startTime;
    const responseBody = await response.text();

    const delivery = await recordWebhookDelivery({
      webhookId,
      event: 'ticket.created',
      payload: samplePayload,
      requestBody: payloadString,
      responseStatus: response.status,
      responseBody,
      durationMs,
      success: response.ok,
    });

    return {
      success: response.ok,
      status: response.status,
      durationMs,
      delivery,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const delivery = await recordWebhookDelivery({
      webhookId,
      event: 'ticket.created',
      payload: samplePayload,
      requestBody: payloadString,
      durationMs,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs,
      delivery,
    };
  }
}

/**
 * Rotate webhook secret
 */
export async function rotateWebhookSecret(webhookId: string) {
  const newSecret = generateWebhookSecret();

  const [webhook] = await db
    .update(webhooks)
    .set({
      secret: newSecret,
      updatedAt: new Date(),
    })
    .where(eq(webhooks.id, webhookId))
    .returning();

  return { webhook, secret: newSecret };
}

/**
 * Get webhook stats for an organization
 */
export async function getOrgWebhookStats(orgId: string) {
  const result = await db
    .select({
      totalWebhooks: count(),
      activeWebhooks: count(sql`CASE WHEN ${webhooks.status} = 'active' THEN 1 END`),
      failingWebhooks: count(sql`CASE WHEN ${webhooks.status} = 'failing' THEN 1 END`),
      totalDeliveries: sql`SUM(${webhooks.totalDeliveries})`,
      totalFailures: sql`SUM(${webhooks.totalFailures})`,
    })
    .from(webhooks)
    .where(eq(webhooks.orgId, orgId));

  return {
    totalWebhooks: Number(result[0]?.totalWebhooks || 0),
    activeWebhooks: Number(result[0]?.activeWebhooks || 0),
    failingWebhooks: Number(result[0]?.failingWebhooks || 0),
    totalDeliveries: Number(result[0]?.totalDeliveries || 0),
    totalFailures: Number(result[0]?.totalFailures || 0),
    successRate: (result[0] as { totalDeliveries?: number; totalFailures?: number })?.totalDeliveries ?? 0 > 0
      ? Number((((Number((result[0] as { totalDeliveries?: number; totalFailures?: number }).totalDeliveries) - Number((result[0] as { totalDeliveries?: number; totalFailures?: number }).totalFailures)) / Number((result[0] as { totalDeliveries?: number; totalFailures?: number }).totalDeliveries)) * 100).toFixed(2))
      : 100,
  };
}
