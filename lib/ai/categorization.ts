import { db } from '@/db';
import { tickets, requestTypes } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Category suggestion with confidence score
export interface CategorySuggestion {
  category: 'INCIDENT' | 'SERVICE_REQUEST' | 'CHANGE_REQUEST';
  confidence: number;
  reason: string;
}

// Keyword-based classifier for MVP
const CATEGORY_KEYWORDS = {
  INCIDENT: [
    'down', 'outage', 'broken', 'error', 'crash', 'failed', 'not working',
    'issue', 'problem', 'bug', 'failure', 'emergency', 'critical', 'urgent',
    'cannot access', 'unable to', 'login failed', 'connection refused',
  ],
  SERVICE_REQUEST: [
    'request', 'need', 'please provide', 'access to', 'setup', 'configure',
    'install', 'new account', 'password reset', 'unlock', 'grant',
    'permission', 'license', 'software', 'hardware', 'equipment',
  ],
  CHANGE_REQUEST: [
    'change', 'update', 'modify', 'upgrade', 'migrate', 'implement',
    'deploy', 'release', 'patch', 'configuration change', 'policy update',
    'system change', 'enhancement', 'feature', 'improvement',
  ],
} as const;

/**
 * Analyze ticket content and suggest category
 */
export function suggestCategory(
  subject: string,
  description: string
): CategorySuggestion {
  const text = `${subject} ${description}`.toLowerCase();
  
  const scores = {
    INCIDENT: 0,
    SERVICE_REQUEST: 0,
    CHANGE_REQUEST: 0,
  };

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        scores[category as keyof typeof scores] += 1;
      }
    }
  }

  const totalMatches = Object.values(scores).reduce((a, b) => a + b, 0);
  
  if (totalMatches === 0) {
    return {
      category: 'SERVICE_REQUEST',
      confidence: 0.33,
      reason: 'No clear indicators - defaulting to service request',
    };
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topCategory, topScore] = sorted[0];
  const secondScore = sorted[1][1];

  const confidence = topScore / totalMatches;
  
  if (topScore === secondScore) {
    return {
      category: 'SERVICE_REQUEST',
      confidence: 0.5,
      reason: 'Ambiguous classification - multiple categories matched equally',
    };
  }

  const reasons: Record<string, string> = {
    INCIDENT: 'Keywords indicate system failure or service disruption',
    SERVICE_REQUEST: 'Keywords indicate a request for service or access',
    CHANGE_REQUEST: 'Keywords indicate planned change or enhancement',
  };

  return {
    category: topCategory as CategorySuggestion['category'],
    confidence: Math.min(confidence + 0.2, 0.95),
    reason: reasons[topCategory],
  };
}

/**
 * Suggest request type based on content analysis
 */
export async function suggestRequestType(
  orgId: string,
  subject: string,
  description: string
): Promise<{ requestTypeId: string | null; confidence: number; name: string | null }> {
  const types = await db.query.requestTypes.findMany({
    where: eq(requestTypes.orgId, orgId),
    columns: {
      id: true,
      name: true,
      description: true,
    },
  });

  if (types.length === 0) {
    return { requestTypeId: null, confidence: 0, name: null };
  }

  const text = `${subject} ${description}`.toLowerCase();
  
  let bestMatch: typeof types[0] | null = null;
  let bestScore = 0;

  for (const type of types) {
    const typeText = `${type.name} ${type.description || ''}`.toLowerCase();
    const typeWords = typeText.split(/\s+/);
    
    let score = 0;
    for (const word of typeWords) {
      if (word.length > 3 && text.includes(word)) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = type;
    }
  }

  if (!bestMatch || bestScore === 0) {
    return { requestTypeId: null, confidence: 0, name: null };
  }

  const confidence = Math.min(bestScore / 5, 0.9);

  return {
    requestTypeId: bestMatch.id,
    confidence,
    name: bestMatch.name,
  };
}

/**
 * Apply AI categorization to a ticket
 */
export async function autoCategorizeTicket(
  ticketId: string,
  confidenceThreshold: number = 0.7
): Promise<{
  applied: boolean;
  category?: CategorySuggestion['category'];
  confidence?: number;
  reason?: string;
}> {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: {
      id: true,
      subject: true,
      description: true,
      category: true,
    },
  });

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  if (ticket.category) {
    return { applied: false };
  }

  const suggestion = suggestCategory(ticket.subject, ticket.description || '');

  if (suggestion.confidence >= confidenceThreshold) {
    await db
      .update(tickets)
      .set({
        category: suggestion.category,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticketId));

    return {
      applied: true,
      category: suggestion.category,
      confidence: suggestion.confidence,
      reason: suggestion.reason,
    };
  }

  return {
    applied: false,
    category: suggestion.category,
    confidence: suggestion.confidence,
    reason: 'Confidence below threshold',
  };
}

/**
 * Batch categorize multiple tickets
 */
export async function batchCategorizeTickets(
  ticketIds: string[],
  confidenceThreshold: number = 0.7
): Promise<{
  processed: number;
  categorized: number;
  failed: number;
}> {
  let categorized = 0;
  let failed = 0;

  for (const ticketId of ticketIds) {
    try {
      const result = await autoCategorizeTicket(ticketId, confidenceThreshold);
      if (result.applied) {
        categorized++;
      }
    } catch (error) {
      console.error(`Failed to categorize ticket ${ticketId}:`, error);
      failed++;
    }
  }

  return {
    processed: ticketIds.length,
    categorized,
    failed,
  };
}
