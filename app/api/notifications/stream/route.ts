import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { redis } from '@/lib/redis';

const STREAM_TIMEOUT = 30000; // 30 seconds
const HEARTBEAT_INTERVAL = 15000; // 15 seconds

/**
 * SSE endpoint for real-time notifications
 * Uses Redis pub/sub to deliver notifications to connected clients
 * 
 * Redis channel format: `notifications:{userId}`
 * Message format: JSON stringified notification object
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = session.user.id;
  const channel = `notifications:${userId}`;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connectedData = JSON.stringify({ type: 'connected', userId });
      controller.enqueue(`data: ${connectedData}\n\n`);

      // Subscribe to Redis channel for this user
      const messageHandler = (message: string) => {
        try {
          controller.enqueue(`data: ${message}\n\n`);
        } catch {
          // Controller might be closed, ignore errors
        }
      };

      // Set up heartbeat to keep connection alive
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(':heartbeat\n\n');
        } catch {
          // Controller might be closed, clear interval
          clearInterval(keepAlive);
        }
      }, HEARTBEAT_INTERVAL);

      // Set up timeout to close connection after reasonable time
      // This allows clients to reconnect and handles stale connections
      const timeout = setTimeout(() => {
        try {
          const timeoutData = JSON.stringify({ type: 'timeout' });
          controller.enqueue(`data: ${timeoutData}\n\n`);
          controller.close();
        } catch {
          // Controller might already be closed
        }
        clearInterval(keepAlive);
      }, STREAM_TIMEOUT);

      // Subscribe to Redis channel
      // We use a simple polling mechanism since Upstash Redis doesn't support
      // true pub/sub subscriptions in the same way as native Redis
      const pollInterval = setInterval(async () => {
        try {
          const message = await redis.rpop<string>(channel);
          if (message) {
            messageHandler(message);
          }
        } catch {
          // Ignore polling errors
        }
      }, 1000);

      // Clean up on abort
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        clearInterval(pollInterval);
        clearTimeout(timeout);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
