/**
 * Tenant-Isolated Data Fetchers for AI Context Building
 * 
 * CRITICAL: All functions in this file MUST enforce org scoping.
 * NEVER pass user-supplied orgId — always derive from security context.
 */

import { db } from '@/db';
import { kbArticles, tickets, ticketComments, services, assets, orgAIMemory, orgAIConfigs, users } from '@/db/schema';
import { and, eq, sql, desc } from 'drizzle-orm';
import { validateDataAccess, AISecurityContext } from './security';

/**
 * Fetch KB articles scoped to the interface and org
 * Returns formatted text for AI context
 */
export async function fetchKBForAI(
  context: AISecurityContext,
  searchQuery?: string,
  limit = 5
): Promise<string> {
  const access = validateDataAccess(context, 'kbArticles');
  if (!access.allowed) {
    return '';
  }

  let articles: Array<{ title: string; content: string | null; excerpt: string | null }> = [];
  
  // Build search filter if query provided
  const searchFilter = searchQuery 
    ? sql`(${kbArticles.title} ILIKE ${'%' + searchQuery + '%'} OR ${kbArticles.content} ILIKE ${'%' + searchQuery + '%'})`
    : null;

  switch (context.interface) {
    case 'public':
      // Public: only public visibility articles
      articles = await db.query.kbArticles.findMany({
        where: searchFilter 
          ? and(
              eq(kbArticles.status, 'published'),
              eq(kbArticles.visibility, 'public'),
              searchFilter
            )
          : and(
              eq(kbArticles.status, 'published'),
              eq(kbArticles.visibility, 'public')
            ),
        orderBy: [desc(kbArticles.viewCount)],
        limit,
        columns: {
          title: true,
          content: true,
          excerpt: true,
        },
      });
      break;

    case 'customer':
      // Customer: org-scoped published articles
      if (!context.orgId) {
        console.warn('[AI Data] Customer request without org context');
        return '';
      }
      articles = await db.query.kbArticles.findMany({
        where: searchFilter
          ? and(
              eq(kbArticles.orgId, context.orgId), // STRICT org isolation
              eq(kbArticles.status, 'published'),
              sql`${kbArticles.visibility} IN ('public', 'organization')`,
              searchFilter
            )
          : and(
              eq(kbArticles.orgId, context.orgId), // STRICT org isolation
              eq(kbArticles.status, 'published'),
              sql`${kbArticles.visibility} IN ('public', 'organization')`
            ),
        orderBy: [desc(kbArticles.viewCount)],
        limit,
        columns: {
          title: true,
          content: true,
          excerpt: true,
        },
      });
      break;

    case 'admin':
      // Admin: all articles for target org
      if (!context.orgId) {
        // No org specified - return empty (admins must specify target org)
        return '';
      }
      articles = await db.query.kbArticles.findMany({
        where: searchFilter
          ? and(eq(kbArticles.orgId, context.orgId), searchFilter)
          : eq(kbArticles.orgId, context.orgId),
        orderBy: [desc(kbArticles.updatedAt)],
        limit: limit * 2, // Admins get more context
        columns: {
          title: true,
          content: true,
          excerpt: true,
        },
      });
      break;
  }

  if (articles.length === 0) {
    return 'No knowledge base articles available.';
  }

  // Format articles for AI context
  return articles
    .map((a, i) => {
      const content = a.excerpt || a.content || '';
      // Strip HTML tags for AI context
      const cleanContent = content.replace(/<[^>]*>/g, '').slice(0, 500);
      return `${i + 1}. ${a.title}\n${cleanContent}`;
    })
    .join('\n\n');
}

/**
 * Fetch ticket summaries for AI context
 * CRITICAL: Customer interface NEVER sees internal notes
 */
export async function fetchTicketSummariesForAI(
  context: AISecurityContext,
  limit = 10
): Promise<string> {
  const access = validateDataAccess(context, 'tickets');
  if (!access.allowed) {
    return '';
  }

  if (!context.orgId) {
    console.warn('[AI Data] Ticket fetch without org context');
    return '';
  }

  switch (context.interface) {
    case 'public':
      // Public never sees tickets
      return '';

    case 'customer': {
      // Customer: org-scoped, public comments only, no agent names
      const customerTickets = await db.query.tickets.findMany({
        where: and(
          eq(tickets.orgId, context.orgId), // STRICT org isolation
          sql`${tickets.status} IN ('open', 'pending', 'resolved')`
        ),
        orderBy: [desc(tickets.updatedAt)],
        limit,
        with: {
          comments: {
            where: eq(ticketComments.isInternal, false), // EXCLUDE internal notes
            orderBy: [desc(ticketComments.createdAt)],
            limit: 3,
          },
          requester: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (customerTickets.length === 0) {
        return 'No recent tickets found.';
      }

      return customerTickets
        .map(t => {
          const publicComments = t.comments
            ?.map(c => `Support Team: ${c.content.slice(0, 200)}`)
            .join('\n') || 'No updates yet.';
          
          return `Ticket ${t.key}: ${t.title}\nStatus: ${t.status}\nRecent activity:\n${publicComments}`;
        })
        .join('\n\n');
    }

    case 'admin': {
      // Admin: full ticket data including internal notes
      const adminTickets = await db.query.tickets.findMany({
        where: eq(tickets.orgId, context.orgId),
        orderBy: [desc(tickets.updatedAt)],
        limit,
        with: {
          comments: {
            orderBy: [desc(ticketComments.createdAt)],
            limit: 5,
          },
          requester: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
          assignee: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (adminTickets.length === 0) {
        return 'No tickets found for this organization.';
      }

      return adminTickets
        .map(t => {
          const comments = t.comments
            ?.map(c => `${c.isInternal ? '[Internal]' : ''} ${c.authorId}: ${c.content.slice(0, 200)}`)
            .join('\n') || 'No comments.';
          
          return `Ticket ${t.key}: ${t.title}\nStatus: ${t.status} | Priority: ${t.priority}\nRequester: ${t.requester?.name || 'Unknown'}\nAssignee: ${t.assignee?.name || 'Unassigned'}\nComments:\n${comments}`;
        })
        .join('\n\n---\n\n');
    }
  }

  return '';
}

/**
 * Fetch service status for AI context
 */
export async function fetchServiceStatusForAI(
  context: AISecurityContext
): Promise<string> {
  const access = validateDataAccess(context, 'services');
  if (!access.allowed || !context.orgId) {
    return '';
  }

  const services_list = await db.query.services.findMany({
    where: eq(services.orgId, context.orgId), // STRICT org isolation
    columns: {
      name: true,
      status: true,
      description: true,
    },
  });

  if (services_list.length === 0) {
    return 'No services configured.';
  }

  return services_list
    .map(s => `- ${s.name}: ${s.status}${s.description ? ` - ${s.description}` : ''}`)
    .join('\n');
}

/**
 * Fetch asset information for AI context
 */
export async function fetchAssetInfoForAI(
  context: AISecurityContext,
  limit = 5
): Promise<string> {
  const access = validateDataAccess(context, 'assets');
  if (!access.allowed || !context.orgId) {
    return '';
  }

  const assets_list = await db.query.assets.findMany({
    where: eq(assets.orgId, context.orgId), // STRICT org isolation
    limit,
    columns: {
      name: true,
      assetType: true,
      status: true,
    },
  });

  if (assets_list.length === 0) {
    return 'No assets found.';
  }

  return assets_list
    .map(a => `- ${a.name} (${a.assetType}): ${a.status}`)
    .join('\n');
}

/**
 * Fetch organization AI memory
 * These are custom instructions/facts configured by admins
 */
export async function fetchOrgAIMemories(
  orgId: string,
  limit = 10
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

  if (memories.length === 0) {
    return '';
  }

  return memories
    .map(m => `[${m.memoryType.toUpperCase()}] ${m.content}`)
    .join('\n');
}

/**
 * Fetch organization AI configuration
 */
export async function fetchOrgAIConfig(orgId: string) {
  const config = await db.query.orgAIConfigs.findFirst({
    where: eq(orgAIConfigs.orgId, orgId),
  });

  if (!config) {
    // Return default config
    return {
      aiEnabled: true,
      customerAIEnabled: true,
      allowKBAccess: true,
      allowTicketSummaries: false,
      allowAssetInfo: false,
      allowServiceStatus: true,
      blockPIIInResponses: true,
      maxResponseTokens: 1000,
      customerRateLimit: 50,
      systemInstructions: null,
    };
  }

  return config;
}

/**
 * Get user's organization memberships
 * Used to verify customer access
 */
export async function getUserOrgMemberships(userId: string): Promise<Array<{ orgId: string; role: string }>> {
  const memberships = await db.query.memberships.findMany({
    where: eq(users.id, userId),
    columns: {
      orgId: true,
      role: true,
    },
  });

  return memberships;
}

/**
 * Format all context for AI system prompt
 * Combines KB, tickets, services, assets, and memories
 */
export async function buildAIContext(
  context: AISecurityContext,
  options: {
    includeKB?: boolean;
    includeTickets?: boolean;
    includeServices?: boolean;
    includeAssets?: boolean;
    includeMemories?: boolean;
  } = {}
): Promise<string> {
  const {
    includeKB = true,
    includeTickets = false,
    includeServices = false,
    includeAssets = false,
    includeMemories = true,
  } = options;

  const parts: string[] = [];

  if (includeMemories && context.orgId) {
    const memories = await fetchOrgAIMemories(context.orgId);
    if (memories) {
      parts.push('ORGANIZATION KNOWLEDGE:\n' + memories);
    }
  }

  if (includeKB) {
    const kb = await fetchKBForAI(context);
    if (kb) {
      parts.push('KNOWLEDGE BASE:\n' + kb);
    }
  }

  if (includeTickets) {
    const tickets_ctx = await fetchTicketSummariesForAI(context);
    if (tickets_ctx) {
      parts.push('RECENT TICKET ACTIVITY:\n' + tickets_ctx);
    }
  }

  if (includeServices && context.orgId) {
    const svc = await fetchServiceStatusForAI(context);
    if (svc) {
      parts.push('SERVICE STATUS:\n' + svc);
    }
  }

  if (includeAssets && context.orgId) {
    const assets_ctx = await fetchAssetInfoForAI(context);
    if (assets_ctx) {
      parts.push('ASSETS:\n' + assets_ctx);
    }
  }

  return parts.join('\n\n---\n\n');
}
