import { NextRequest, NextResponse } from 'next/server';
import { publishRealtimeEvent } from '@/lib/realtime/broadcast';
import { verifyRealtimeSignature } from '@/lib/realtime/signing';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const valid = verifyRealtimeSignature({
    body,
    timestamp: request.headers.get('x-atlas-timestamp'),
    signature: request.headers.get('x-atlas-signature'),
  });

  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = JSON.parse(body) as {
    orgId: string;
    channel: string;
    event: string;
    data: Record<string, unknown>;
  };

  if (!payload.orgId || !payload.channel || !payload.event) {
    return NextResponse.json({ error: 'Invalid broadcast payload' }, { status: 400 });
  }

  await publishRealtimeEvent(payload);
  return NextResponse.json({ success: true });
}
