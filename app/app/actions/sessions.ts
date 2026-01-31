'use server';

import { db } from '@/db';
import { userSessions } from '@/db/schema';
import { requireAuth } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { getUserSessions, getAllUserSessions, revokeSession, revokeAllOtherSessions } from '@/lib/auth/sessions';
import { getSessionTokenFromCookie, hashSessionToken } from '@/lib/auth/session-tracking';

/**
 * Get current user's active sessions
 */
export async function getUserSessionsAction() {
  const user = await requireAuth();

  const sessions = await getUserSessions(user.id);
  return sessions;
}

/**
 * Get current user's all sessions (including revoked)
 */
export async function getAllUserSessionsAction() {
  const user = await requireAuth();

  const sessions = await getAllUserSessions(user.id);
  return sessions;
}

/**
 * Revoke a specific session
 */
export async function revokeSessionAction(sessionToken: string) {
  const user = await requireAuth();

  // Verify the session belongs to the user
  const sessions = await db
    .select()
    .from(userSessions)
    .where(
      and(
        eq(userSessions.sessionToken, sessionToken),
        eq(userSessions.userId, user.id)
      )
    )
    .limit(1);

  if (sessions.length === 0) {
    throw new Error('Session not found');
  }

  await revokeSession(sessionToken, user.id);

  revalidatePath('/app/settings/sessions');
  return { success: true };
}

/**
 * Revoke all other sessions (except current)
 */
export async function revokeAllOtherSessionsAction() {
  const user = await requireAuth();

  // Get current session token from cookie and hash it
  const sessionToken = await getSessionTokenFromCookie();
  if (!sessionToken) {
    throw new Error('No active session found');
  }

  const currentSessionToken = hashSessionToken(sessionToken);
  await revokeAllOtherSessions(user.id, currentSessionToken);

  revalidatePath('/app/settings/sessions');
  return { success: true };
}

/**
 * Revoke all other sessions except current (if we have session token)
 */
export async function revokeAllOtherSessionsExceptCurrentAction(currentSessionToken: string) {
  const user = await requireAuth();

  await revokeAllOtherSessions(user.id, currentSessionToken);

  revalidatePath('/app/settings/sessions');
  return { success: true };
}
