/**
 * AI Data Fetchers - Tenant-isolated data fetching for AI context
 * 
 * These functions fetch data for AI context. They ALWAYS enforce org scoping.
 * NEVER pass user-supplied orgId — always derive from session/auth context.
 */

import { db } from '@/db';
import { kbArticles, tickets, ticketComments, services, assets, orgAIMemory, orgAIConfigs } from '@/db/schema';
import { and, eq, sql, desc } from 'drizzle-orm';
import { AISecurityContext, validateDataAccess } from './security';

/**
 * Fetch KB articles scoped to the interface and org
 */
export async function fetchKBForAI(
  context: AISecurityContext,
  query?: string,
  limit: number = 5
): Promise<string> {
  const access = validateDataAccess(context, 'kbArticles');
  if (!access.allowed) return '';

  let articles: typeof kbArticles.$inferSelect[] = [];

  if (context.interface === 'public') {
    // Public: only public visibility articles
    articles = await db.query.kbArticles.findMany({
      where: and(
        eq(kbArticles.status, 'published'),
        eq(kbArticles.visibility, 'public')
      ),
      orderBy: query ? sql`similarity(${kbArticles.title}, ${query}) DESC` : desc(kbArticles.viewCount),
      limit,
      columns: {
        title: true,
        content: true,
        excerpt: true,
        slug: true,
      },
    });
  } else if (context.interface === 'customer' && context.orgId) {
    // Customer: org-scoped articles (public + org-only)
    articles = await db.query.kbArticles.findMany({
      where: and(
        eq(kbArticles.orgId, context.orgId),
        eq(kbArticles.status, 'published'),
        sql`${kbArticles.visibility} IN ('public', 'organization')`
      ),
      orderBy: query ? sql`similarity(${kbArticles.title}, ${query}) DESC` : desc(kbArticles.viewCount),
      limit,
      columns: {
        title: true,
        content: true,
        excerpt: true,
        slug: true,
      },
    });
  } else if (context.interface === 'admin') {
    // Admin: all articles for the target org
    const targetOrgId = context.orgId; // Admin can specify which org
    if (targetOrgId) {
      articles = await db.query.kbArticles.findMany({
        where: eq(kbArticles.orgId, targetOrgId),
        orderBy: query ? sql`similarity(${kbArticles.title}, ${query}) DESC` : desc(kbArticles.updatedAt),
        limit,
        columns: {
          title: true,
          content: true,
          excerpt: true,
          slug: true,
          visibility: true,
          status: true,
        },
      });
    }
  }

  // Format as text, strip HTML, limit tokens
  return articles.map(a => {
    const content = a.excerpt || a.content?.substring(0, 500) || '';
    return `## ${a.title}\n${content}${a.slug ? `\n[Read more: /kb/${a.slug}]` : ''}`;
  }).join('\n\n');
}

/**
 * Fetch ticket summaries for customer AI (NO internal notes)
 */
export async function fetchTicketSummariesForAI(
  context: AISecurityContext,
  limit: number = 10
): Promise<string> {
  const access = validateDataAccess(context, 'tickets');
  if (!access.allowed || !context.orgId) return '';

  // For customer interface: only public comments, anonymize agent names
  const ticketData = await db.query.tickets.findMany({
    where: and(
      eq(tickets.orgId, context.orgId),
      sql`${tickets.status} IN ('NEW', 'OPEN', 'WAITING_ON_CUSTOMER', 'IN_PROGRESS')`
    ),
    orderBy: desc(tickets.createdAt),
    limit,
    with: {
      comments: {
        where: eq(ticketComments.isInternal, false), // NO INTERNAL NOTES
        orderBy: desc(ticketComments.createdAt),
        limit: 3,
        columns: {
          content: true,
          createdAt: true,
        },
      },
    },
    columns: {
      key: true,
      subject: true,
      status: true,
      createdAt: true,
    },
  });

  return ticketData.map(t => {
    const comments = t.comments.map(c => `  - ${c.content?.substring(0, 100)}...`).join('\n');
    return `- ${t.key}: ${t.subject} (${t.status})\n${comments}`;
  }).join('\n\n');
}

/**
 * Fetch service status for customer AI
 */
export async function fetchServiceStatusForAI(
  context: AISecurityContext
): Promise<string> {
  const access = validateDataAccess(context, 'services');
  if (!access.allowed || !context.orgId) return '';

  const servicesList = await db.query.services.findMany({
    where: eq(services.orgId, context.orgId),
    columns: {
      name: true,
      status: true,
      uptimePercentage: true,
    },
  });

  if (servicesList.length === 0) return '';

  return servicesList.map(s => 
    `- ${s.name}: ${s.status}${s.uptimePercentage ? ` (${s.uptimePercentage}% uptime)` : ''}`
  ).join('\n');
}

/**
 * Fetch org AI memories
 */
export async function fetchOrgAIMemories(
  orgId: string,
  limit: number = 10
): Promise<string> {
  const memories = await db.query.orgAIMemory.findMany({
    where: and(
      eq(orgAIMemory.orgId, orgId),
      eq(orgAIMemory.isActive, true)
    ),
    orderBy: [desc(orgAIMemory.priority), desc(orgAIMemory.createdAt)],
    limit,
    columns: {
      memoryType: true,
      content: true,
    },
  });

  return memories.map(m => `[${m.memoryType.toUpperCase()}] ${m.content}`).join('\n');
}

/**
 * Fetch org AI config
 */
export async function fetchOrgAIConfig(
  orgId: string
): Promise<typeof orgAIConfigs.$inferSelect | null> {
  return await db.query.orgAIConfigs.findFirst({
    where: eq(orgAIConfigs.orgId, orgId),
  });
}

/**
 * Create default AI config for org if doesn't exist
 */
export async function ensureOrgAIConfig(orgId: string): Promise<void> {
  const existing = await db.query.orgAIConfigs.findFirst({
    where: eq(orgAIConfigs.orgId, orgId),
  });
  
  if (!existing) {
    await db.insert(orgAIConfigs).values({
      orgId,
      aiEnabled: true,
      customerAIEnabled: true,
      allowKBAccess: true,
      allowTicketSummaries: false,
      allowAssetInfo: false,
      allowServiceStatus: true,
      blockPIIInResponses: true,
      maxResponseTokens: 1000,
      customerRateLimit: 50,
    });
  }
}
