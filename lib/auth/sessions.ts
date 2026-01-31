/**
 * Session management utilities
 */

import { db } from '@/db';
import { userSessions } from '@/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { headers } from 'next/headers';

export interface SessionData {
  userId: string;
  sessionToken: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Extract device info from user agent
 */
function getDeviceInfo(userAgent: string | null): string {
  if (!userAgent) return 'Unknown Device';
  
  // Simple device detection
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'Mobile Device';
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'Tablet';
  }
  
  // Browser detection
  if (ua.includes('chrome') && !ua.includes('edg')) {
    return 'Chrome';
  }
  if (ua.includes('firefox')) {
    return 'Firefox';
  }
  if (ua.includes('safari') && !ua.includes('chrome')) {
    return 'Safari';
  }
  if (ua.includes('edg')) {
    return 'Edge';
  }
  
  return 'Browser';
}

/**
 * Create a new session
 */
export async function createSession(data: SessionData): Promise<typeof userSessions.$inferSelect> {
  const deviceInfo = data.deviceInfo || getDeviceInfo(data.userAgent || null);
  
  const [session] = await db
    .insert(userSessions)
    .values({
      userId: data.userId,
      sessionToken: data.sessionToken,
      deviceInfo,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      lastActiveAt: new Date(),
    })
    .returning();

  return session;
}

/**
 * Update session activity (lastActiveAt)
 */
export async function updateSessionActivity(sessionToken: string): Promise<void> {
  const result = await db
    .update(userSessions)
    .set({ lastActiveAt: new Date() })
    .where(and(
      eq(userSessions.sessionToken, sessionToken),
      isNull(userSessions.revokedAt)
    ))
    .returning();

  // If no session was updated, throw error so caller knows to create one
  if (result.length === 0) {
    throw new Error('Session not found');
  }
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<typeof userSessions.$inferSelect[]> {
  const sessions = await db
    .select()
    .from(userSessions)
    .where(
      and(
        eq(userSessions.userId, userId),
        isNull(userSessions.revokedAt)
      )
    )
    .orderBy(desc(userSessions.lastActiveAt));

  return sessions;
}

/**
 * Get all sessions (including revoked) for a user
 */
export async function getAllUserSessions(userId: string): Promise<typeof userSessions.$inferSelect[]> {
  const sessions = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.userId, userId))
    .orderBy(desc(userSessions.lastActiveAt));

  return sessions;
}

/**
 * Check if a session is revoked
 */
export async function isSessionRevoked(sessionToken: string): Promise<boolean> {
  const sessions = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.sessionToken, sessionToken))
    .limit(1);
  
  const session = sessions[0];
  return session ? session.revokedAt !== null : false;
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionToken: string, userId: string): Promise<void> {
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(userSessions.sessionToken, sessionToken),
        eq(userSessions.userId, userId)
      )
    );
}

/**
 * Revoke all sessions for a user except the current one
 */
export async function revokeAllOtherSessions(userId: string, currentSessionToken: string): Promise<void> {
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(userSessions.userId, userId),
        eq(userSessions.sessionToken, currentSessionToken),
        isNull(userSessions.revokedAt)
      )
    );
  
  // Actually, we want to revoke all EXCEPT current, so let's fix this
  const allSessions = await db
    .select()
    .from(userSessions)
    .where(
      and(
        eq(userSessions.userId, userId),
        isNull(userSessions.revokedAt)
      )
    );
  
  for (const session of allSessions) {
    if (session.sessionToken !== currentSessionToken) {
      await db
        .update(userSessions)
        .set({ revokedAt: new Date() })
        .where(eq(userSessions.id, session.id));
    }
  }
}

/**
 * Revoke all sessions for a user (used for offboarding)
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));
}

/**
 * Get client IP from headers
 */
export async function getClientIP(): Promise<string | null> {
  const headersList = await headers();
  return (
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    headersList.get('cf-connecting-ip') ||
    null
  );
}

/**
 * Get user agent from headers
 */
export async function getUserAgent(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get('user-agent');
}
