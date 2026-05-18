import { redis } from '@/lib/redis';
import { getRealtimeSecret, signRealtimePayload } from './signing';

export interface RealtimeBroadcast {
  orgId: string;
  channel: string;
  event: string;
  data: Record<string, unknown>;
}

function redisChannel(orgId: string, channel: string) {
  return `realtime:${orgId}:${channel}`;
}

export async function publishRealtimeEvent(payload: RealtimeBroadcast) {
  const body = JSON.stringify(payload);
  const message = JSON.stringify({
    ...payload,
    timestamp: new Date().toISOString(),
  });

  await redis.lpush(redisChannel(payload.orgId, payload.channel), message);
  const count = await redis.llen(redisChannel(payload.orgId, payload.channel));
  for (let i = 0; i < Math.max(0, count - 100); i++) {
    await redis.rpop(redisChannel(payload.orgId, payload.channel));
  }

  const url = process.env.REALTIME_BROADCAST_URL;
  const secret = getRealtimeSecret();
  if (!url || !secret) {
    return { deliveredToBridge: false };
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signRealtimePayload(body, timestamp, secret);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-atlas-timestamp': timestamp,
      'x-atlas-signature': signature,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Realtime bridge rejected broadcast: ${response.status}`);
  }

  return { deliveredToBridge: true };
}

export async function popRealtimeEvent(orgId: string, channel: string) {
  return redis.rpop<string>(redisChannel(orgId, channel));
}
