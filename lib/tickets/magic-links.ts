import { db } from '@/db';
import { ticketTokens } from '@/db/schema';
import { and, eq, gt, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import { redis } from '@/lib/redis';

type TicketTokenPurpose = 'VIEW' | 'REPLY';

const DEFAULT_EXPIRY_DAYS = 30;
const TOKEN_BYTES = 32;
const TOKEN_FAILURE_TTL_SECONDS = 60 * 60 * 24 * 2;

function getTokenPepper() {
  const pepper = process.env.TOKEN_PEPPER;
  if (!pepper) {
    throw new Error('TOKEN_PEPPER environment variable is not set');
  }
  return pepper;
}

/**
 * Generate a secure random token for magic link access
 */
export function generateToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

function hashToken(token: string): string {
  return crypto
    .createHmac('sha256', getTokenPepper())
    .update(token)
    .digest('hex');
}

async function trackTokenFailure(reason: string) {
  try {
    const key = `security:token_fail:${new Date().toISOString().slice(0, 10)}:${reason}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, TOKEN_FAILURE_TTL_SECONDS);
    }
  } catch (error) {
    console.warn('[Security] Failed to track token failure', error);
  }
}

/**
 * Create a magic link token for a ticket
 * Token expires in 30 days by default
 */
export async function createTicketToken(params: {
  ticketId: string;
  email: string;
  purpose: TicketTokenPurpose;
  expiresInDays?: number;
  createdIp?: string | null;
  lastSentAt?: Date | null;
}): Promise<string> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (params.expiresInDays ?? DEFAULT_EXPIRY_DAYS));

  await db.insert(ticketTokens).values({
    tokenHash,
    ticketId: params.ticketId,
    email: params.email,
    purpose: params.purpose,
    expiresAt,
    createdIp: params.createdIp ?? null,
    lastSentAt: params.lastSentAt ?? null,
  });

  return token;
}

/**
 * Consume a token in a transaction (single-use)
 */
export async function consumeTicketToken(params: {
  token: string;
  purpose: TicketTokenPurpose;
  usedIp?: string | null;
}): Promise<{ ticketId: string; email: string } | null> {
  const tokenHash = hashToken(params.token);

  const result = await db.transaction(async (tx) => {
    const tokenRecord = await tx.query.ticketTokens.findFirst({
      where: and(
        eq(ticketTokens.tokenHash, tokenHash),
        eq(ticketTokens.purpose, params.purpose),
        isNull(ticketTokens.usedAt),
        gt(ticketTokens.expiresAt, new Date())
      ),
    });

    if (!tokenRecord) {
      return null;
    }

    await tx
      .update(ticketTokens)
      .set({ usedAt: new Date(), usedIp: params.usedIp ?? null })
      .where(eq(ticketTokens.id, tokenRecord.id));

    return {
      ticketId: tokenRecord.ticketId,
      email: tokenRecord.email,
    };
  });

  if (!result) {
    await trackTokenFailure('invalid');
  }

  return result;
}
