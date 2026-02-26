import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { tickets, users, kbArticles } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// POST - Get AI suggestions for a ticket
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticketId, subject, description } = await req.json();

    const suggestions = [];

    // 1. Categorization suggestion
    const categorySuggestion = await suggestCategory(subject, description);
    if (categorySuggestion) {
      suggestions.push({
        id: `category-${ticketId}`,
        type: 'category',
        confidence: categorySuggestion.confidence,
        title: `Categorize as "${categorySuggestion.category}"`,
        description: `This ticket appears to be about ${categorySuggestion.category.toLowerCase()}.`,
        action: {
          type: 'apply',
          label: 'Apply Category',
          data: { category: categorySuggestion.category },
        },
      });
    }

    // 2. Priority suggestion
    const prioritySuggestion = await suggestPriority(subject, description);
    if (prioritySuggestion) {
      suggestions.push({
        id: `priority-${ticketId}`,
        type: 'priority',
        confidence: prioritySuggestion.confidence,
        title: `Set priority to ${prioritySuggestion.priority}`,
        description: prioritySuggestion.reason,
        action: {
          type: 'apply',
          label: 'Set Priority',
          data: { priority: prioritySuggestion.priority },
        },
      });
    }

    // 3. Assignee suggestion based on past similar tickets
    const assigneeSuggestion = await suggestAssignee(subject, description);
    if (assigneeSuggestion) {
      suggestions.push({
        id: `assignee-${ticketId}`,
        type: 'assignee',
        confidence: assigneeSuggestion.confidence,
        title: `Assign to ${assigneeSuggestion.user.name}`,
        description: `Based on similar tickets they've resolved.`,
        action: {
          type: 'apply',
          label: 'Assign',
          data: { assigneeId: assigneeSuggestion.user.id },
        },
      });
    }

    // 4. Related KB articles
    const kbSuggestions = await suggestKbArticles(subject, description);
    if (kbSuggestions.length > 0) {
      suggestions.push({
        id: `kb-${ticketId}`,
        type: 'kb',
        confidence: 0.8,
        title: 'Related knowledge base articles',
        description: `${kbSuggestions.length} articles might help resolve this issue.`,
        action: {
          type: 'view',
          label: 'View Articles',
          data: { articles: kbSuggestions },
        },
      });
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}

// Simple keyword-based categorization
async function suggestCategory(subject: string, description: string) {
  const text = (subject + ' ' + description).toLowerCase();
  
  const keywords = {
    'INCIDENT': ['outage', 'down', 'error', 'crash', 'broken', 'failed', 'not working', 'urgent', 'critical'],
    'SERVICE_REQUEST': ['request', 'access', 'permission', 'setup', 'configure', 'install'],
    'CHANGE_REQUEST': ['change', 'update', 'upgrade', 'migrate', 'modify', 'configure'],
  };

  let bestCategory = 'SERVICE_REQUEST';
  let maxMatches = 0;

  for (const [category, words] of Object.entries(keywords)) {
    const matches = words.filter(w => text.includes(w)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestCategory = category;
    }
  }

  return {
    category: bestCategory,
    confidence: Math.min(0.5 + maxMatches * 0.15, 0.95),
  };
}

// Priority suggestion based on keywords
async function suggestPriority(subject: string, description: string) {
  const text = (subject + ' ' + description).toLowerCase();
  
  const p1Keywords = ['urgent', 'critical', 'outage', 'down', 'emergency', 'all users', 'production down'];
  const p2Keywords = ['important', 'high priority', 'many users', 'workaround', 'degraded'];
  
  const p1Matches = p1Keywords.filter(w => text.includes(w)).length;
  const p2Matches = p2Keywords.filter(w => text.includes(w)).length;
  
  if (p1Matches > 0) {
    return {
      priority: 'P1',
      reason: 'Contains critical/urgent keywords that suggest high business impact.',
      confidence: Math.min(0.6 + p1Matches * 0.1, 0.9),
    };
  }
  
  if (p2Matches > 0) {
    return {
      priority: 'P2',
      reason: 'Contains keywords suggesting significant impact.',
      confidence: Math.min(0.5 + p2Matches * 0.1, 0.8),
    };
  }
  
  return null;
}

// Suggest assignee based on past similar tickets
async function suggestAssignee(subject: string, description: string) {
  const text = (subject + ' ' + description).toLowerCase();
  
  // Get internal users who have resolved similar tickets
  const similarTickets = await db.query.tickets.findMany({
    where: and(
      sql`LOWER(${tickets.subject}) LIKE ${`%${text.slice(0, 50)}%`}`,
      eq(tickets.status, 'RESOLVED')
    ),
    with: {
      assignee: true,
    },
    limit: 10,
  });

  if (similarTickets.length === 0) return null;

  // Count by assignee
  const assigneeCounts = new Map();
  similarTickets.forEach(t => {
    if (t.assignee) {
      const key = t.assignee.id;
      assigneeCounts.set(key, {
        count: (assigneeCounts.get(key)?.count || 0) + 1,
        user: t.assignee,
      });
    }
  });

  // Get top assignee
  let topAssignee = null;
  let maxCount = 0;
  
  for (const [_, data] of assigneeCounts) {
    if (data.count > maxCount) {
      maxCount = data.count;
      topAssignee = data.user;
    }
  }

  if (!topAssignee) return null;

  return {
    user: topAssignee,
    confidence: Math.min(0.5 + maxCount * 0.1, 0.85),
  };
}

// Suggest related KB articles
async function suggestKbArticles(subject: string, description: string) {
  const text = (subject + ' ' + description).toLowerCase();
  const keywords = text.split(' ').filter(w => w.length > 4).slice(0, 10);
  
  if (keywords.length === 0) return [];

  // Query KB articles with matching keywords
  const articles = await db.query.kbArticles.findMany({
    where: sql`(
      to_tsvector('english', ${kbArticles.title} || ' ' || COALESCE(${kbArticles.content}, '')) @@ 
      plainto_tsquery('english', ${keywords.join(' | ')})
    )`,
    limit: 3,
  });

  return articles.map(a => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
  }));
}
