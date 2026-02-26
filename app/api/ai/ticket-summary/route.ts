import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { tickets, ticketComments, users, kbArticles, memberships } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.BASETEN_API_KEY || '',
  baseURL: process.env.BASETEN_BASE_URL || 'https://inference.baseten.co/v1',
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticketId } = await req.json();
    if (!ticketId) {
      return NextResponse.json({ error: 'Ticket ID required' }, { status: 400 });
    }

    // Fetch ticket with comments
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, ticketId),
      with: {
        requester: true,
        assignee: true,
        organization: true,
        comments: {
          with: {
            user: true,
          },
          orderBy: (comments) => comments.createdAt,
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Check permissions - internal users or ticket participants
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { isInternal: true },
    });

    let hasAccess = user?.isInternal || ticket.requesterId === session.user.id;
    
    if (!hasAccess && ticket.orgId) {
      const membership = await db.query.memberships.findFirst({
        where: and(
          eq(memberships.userId, session.user.id),
          eq(memberships.orgId, ticket.orgId)
        ),
      });
      hasAccess = !!membership;
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build conversation transcript
    const transcript = ticket.comments.map(c => {
      const author = c.user?.name || c.user?.email || c.authorEmail || 'Unknown';
      const prefix = c.isInternal ? '[Internal]' : '';
      return `${prefix}${author} (${new Date(c.createdAt).toLocaleDateString()}):\n${c.content}`;
    }).join('\n\n---\n\n');

    // Find related KB articles
    const relatedArticles = await db.query.kbArticles.findMany({
      where: and(
        eq(kbArticles.status, 'published'),
        sql`(${kbArticles.title} ILIKE ${'%' + ticket.subject + '%'} OR ${kbArticles.content} ILIKE ${'%' + ticket.subject + '%'})`
      ),
      limit: 3,
      columns: { title: true, slug: true, excerpt: true },
    });

    const prompt = `You are Zeus AI, an expert IT support analyst for AGR Networks. Analyze this support ticket and provide a concise summary with actionable recommendations.

## Ticket Information
- **ID**: ${ticket.key}
- **Subject**: ${ticket.subject}
- **Status**: ${ticket.status}
- **Priority**: ${ticket.priority}
- **Category**: ${ticket.category}
- **Requester**: ${ticket.requester?.name || ticket.requester?.email || 'Unknown'}
- **Assigned to**: ${ticket.assignee?.name || ticket.assignee?.email || 'Unassigned'}
- **Created**: ${new Date(ticket.createdAt).toLocaleString()}

## Description
${ticket.description || 'No description provided.'}

## Conversation History
${transcript || 'No comments yet.'}

${relatedArticles.length > 0 ? `## Related Knowledge Base Articles
${relatedArticles.map(a => `- ${a.title}${a.excerpt ? `: ${a.excerpt.slice(0, 100)}...` : ''}`).join('\n')}` : ''}

---

Provide your analysis in this format:

## Summary
A 2-3 sentence summary of the issue and current state.

## Key Points
- Point 1
- Point 2
- Point 3

## Recommendations
1. **Immediate Action**: What should be done right now
2. **Next Steps**: Follow-up actions
3. **Resolution Path**: How to resolve this ticket

## Related Resources
${relatedArticles.length > 0 ? 'Reference the KB articles above if relevant.' : 'No related KB articles found.'}

Be concise, professional, and actionable.`;

    const completion = await client.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: 'You are Zeus AI, an expert IT support analyst. Provide concise, actionable ticket analysis.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const analysis = completion.choices[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      analysis,
      ticketKey: ticket.key,
      relatedArticles: relatedArticles.map(a => ({
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt,
      })),
    });

  } catch (error) {
    console.error('[AI Ticket Summary] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate analysis' },
      { status: 500 }
    );
  }
}
