import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { kbArticles, memberships, tickets } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { detectPromptInjection, getSafeResponse } from '@/lib/ai/prompt-guard';
import { getAIResponse } from '@/lib/ai/client';
import { logAIInteraction } from '@/lib/ai/audit';
import { redactPII } from '@/lib/ai/pii';

const SUMMARY_SYSTEM_PROMPT =
  'You are Zeus AI, an expert IT support analyst. Summarize ticket threads in exactly three concise sentences and do not expose personal data.';

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function getClientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || null;
}

async function canSummarizeTicket(
  user: {
    id: string;
    isInternal?: boolean;
    isPlatformAdmin?: boolean;
  },
  ticket: { orgId: string | null; requesterId: string | null }
) {
  if (user.isPlatformAdmin) return true;
  if (!ticket.orgId) return ticket.requesterId === user.id;
  if (!user.isInternal) return ticket.requesterId === user.id;

  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, user.id),
      eq(memberships.orgId, ticket.orgId),
      eq(memberships.isActive, true)
    ),
    columns: { id: true },
  });

  return Boolean(membership);
}

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

    /* eslint-disable no-restricted-syntax -- Resolve by ticket id first, then enforce org/requester authorization before using AI context. */
    const fullTicket = await db.query.tickets.findFirst({
      where: eq(tickets.id, ticketId),
      with: {
        requester: true,
        assignee: true,
        organization: true,
        comments: {
          with: { user: true },
          orderBy: (comments, { asc }) => [asc(comments.createdAt)],
        },
      },
    });
    /* eslint-enable no-restricted-syntax */

    if (!fullTicket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const allowed = await canSummarizeTicket(session.user, {
      orgId: fullTicket.orgId,
      requesterId: fullTicket.requesterId,
    });
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const relatedArticles = await db.query.kbArticles.findMany({
      where: and(
        eq(kbArticles.status, 'published'),
        fullTicket.orgId
          ? eq(kbArticles.orgId, fullTicket.orgId)
          : sql`${kbArticles.orgId} IS NULL`,
        sql`(${kbArticles.title} ILIKE ${'%' + fullTicket.subject + '%'} OR ${kbArticles.content} ILIKE ${'%' + fullTicket.subject + '%'})`
      ),
      limit: 3,
      columns: { title: true, slug: true, excerpt: true },
    });

    const transcript = fullTicket.comments.map((comment) => {
      const author = comment.user?.name || comment.user?.email || comment.authorEmail || 'Unknown';
      const prefix = comment.isInternal ? '[Internal] ' : '';
      return `${prefix}${author} (${new Date(comment.createdAt).toISOString()}):\n${comment.content}`;
    }).join('\n\n---\n\n');

    const prompt = `Analyze this support ticket and summarize the issue, current state, and recommended next action in exactly three sentences.

Ticket:
- Key: ${fullTicket.key}
- Subject: ${fullTicket.subject}
- Status: ${fullTicket.status}
- Priority: ${fullTicket.priority}
- Category: ${fullTicket.category}
- Requester: ${fullTicket.requester?.name || fullTicket.requester?.email || 'Unknown'}
- Assigned to: ${fullTicket.assignee?.name || fullTicket.assignee?.email || 'Unassigned'}

Description:
${fullTicket.description || 'No description provided.'}

Conversation:
${transcript || 'No comments yet.'}

${relatedArticles.length > 0 ? `Related KB:
${relatedArticles.map((article) => `- ${article.title}${article.excerpt ? `: ${article.excerpt.slice(0, 100)}` : ''}`).join('\n')}` : ''}

Return only the three-sentence summary.`;

    const requestPII = redactPII(prompt);
    const injectionCheck = detectPromptInjection(requestPII.redacted);
    const startedAt = Date.now();
    const ipAddress = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || undefined;
    const systemPromptHash = sha256(SUMMARY_SYSTEM_PROMPT);

    if (injectionCheck.shouldBlock) {
      const safeResponse = getSafeResponse(injectionCheck.threats);
      await logAIInteraction({
        orgId: fullTicket.orgId,
        userId: session.user.id,
        interface: 'admin',
        userQuery: requestPII.redacted,
        systemPromptHash,
        aiResponse: safeResponse,
        responseTimeMs: Date.now() - startedAt,
        piiDetected: requestPII.detected,
        piiTypes: requestPII.types,
        wasFiltered: true,
        sourcesUsed: ['ticket:summary'],
        ipAddress,
        userAgent,
        metadata: {
          blocked: true,
          threats: injectionCheck.threats,
          piiCounts: requestPII.counts,
          ticketId: fullTicket.id,
        },
      });

      return NextResponse.json({
        success: false,
        blocked: true,
        error: safeResponse,
        piiRedaction: {
          applied: requestPII.detected,
          requestTypes: requestPII.types,
          requestCounts: requestPII.counts,
        },
      }, { status: 400 });
    }

    const completion = await getAIResponse([
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: injectionCheck.sanitizedInput },
    ], {
      model: 'deepseek-ai/DeepSeek-V3.1',
      temperature: 0.3,
      max_tokens: 220,
    });

    const responsePII = redactPII(completion.choices[0]?.message?.content || '');
    const analysis = responsePII.redacted;
    const piiTypes = Array.from(new Set([...requestPII.types, ...responsePII.types]));

    await logAIInteraction({
      orgId: fullTicket.orgId,
      userId: session.user.id,
      interface: 'admin',
      userQuery: requestPII.redacted,
      systemPromptHash,
      aiResponse: analysis,
      modelUsed: completion.model,
      tokensUsed: completion.usage?.total_tokens,
      responseTimeMs: Date.now() - startedAt,
      piiDetected: piiTypes.length > 0,
      piiTypes,
      wasFiltered: piiTypes.length > 0 || injectionCheck.isSuspicious,
      sourcesUsed: ['ticket:summary', ...(relatedArticles.length > 0 ? ['kb:related'] : [])],
      ipAddress,
      userAgent,
      metadata: {
        threats: injectionCheck.threats,
        requestPIICounts: requestPII.counts,
        responsePIICounts: responsePII.counts,
        ticketId: fullTicket.id,
      },
    });

    return NextResponse.json({
      success: true,
      analysis,
      ticketKey: fullTicket.key,
      piiRedaction: {
        applied: piiTypes.length > 0,
        requestTypes: requestPII.types,
        responseTypes: responsePII.types,
        requestCounts: requestPII.counts,
        responseCounts: responsePII.counts,
      },
      relatedArticles: relatedArticles.map((article) => ({
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
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
