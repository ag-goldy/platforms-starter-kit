import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { memberships } from '@/db/schema';
import { popRealtimeEvent } from '@/lib/realtime/broadcast';
import { and, eq } from 'drizzle-orm';

const HEARTBEAT_INTERVAL_MS = 15000;
const POLL_INTERVAL_MS = 1000;
const STREAM_TIMEOUT_MS = 30000;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId') || '';
  const channel = searchParams.get('channel') || 'tickets';

  if (!orgId) {
    return new Response('Missing orgId', { status: 400 });
  }

  if (!session.user.isPlatformAdmin) {
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.orgId, orgId),
        eq(memberships.userId, session.user.id),
        eq(memberships.isActive, true)
      ),
    });

    if (!membership) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(`data: ${JSON.stringify({ event: 'connected', orgId, channel })}\n\n`);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(':heartbeat\n\n');
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL_MS);

      const poll = setInterval(async () => {
        try {
          const message = await popRealtimeEvent(orgId, channel);
          if (message) {
            controller.enqueue(`data: ${message}\n\n`);
          }
        } catch {
          // Keep SSE open through transient Redis errors.
        }
      }, POLL_INTERVAL_MS);

      const timeout = setTimeout(() => {
        try {
          controller.enqueue(`data: ${JSON.stringify({ event: 'timeout' })}\n\n`);
          controller.close();
        } catch {}
        clearInterval(heartbeat);
        clearInterval(poll);
      }, STREAM_TIMEOUT_MS);

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        clearInterval(poll);
        clearTimeout(timeout);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
