import { NextRequest } from 'next/server';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = session.user.id;

  const stream = new ReadableStream({
    start(controller) {
      const data = JSON.stringify({ type: 'connected', userId });
      controller.enqueue(`data: ${data}\n\n`);

      const keepAlive = setInterval(() => {
        controller.enqueue(':keep-alive\n\n');
      }, 30000);

      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
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
