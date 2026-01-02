import { db } from '@/db';
import { ticketTokens } from '@/db/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Generate a secure random token for magic link access
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Create a magic link token for a ticket
 * Token expires in 30 days
 */
export async function createTicketToken(ticketId: string, email: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiration

  await db.insert(ticketTokens).values({
    token,
    ticketId,
    email,
    expiresAt,
  });

  return token;
}

/**
 * Validate and retrieve ticket token
 * Returns ticketId if token is valid, null otherwise
 */
export async function validateTicketToken(token: string): Promise<{
  ticketId: string;
  email: string;
} | null> {
  const tokenRecord = await db.query.ticketTokens.findFirst({
    where: and(
      eq(ticketTokens.token, token),
      isNull(ticketTokens.usedAt), // Not used yet
      gt(ticketTokens.expiresAt, new Date()) // Not expired
    ),
  });

  if (!tokenRecord) {
    return null;
  }

  return {
    ticketId: tokenRecord.ticketId,
    email: tokenRecord.email,
  };
}

/**
 * Mark a token as used
 */
export async function markTokenAsUsed(token: string): Promise<void> {
  await db
    .update(ticketTokens)
    .set({ usedAt: new Date() })
    .where(eq(ticketTokens.token, token));
}

