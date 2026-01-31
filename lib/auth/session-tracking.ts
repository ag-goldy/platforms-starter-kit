/**
 * Session tracking utilities for NextAuth v5 JWT strategy
 * Since NextAuth v5 JWT doesn't expose session tokens directly,
 * we extract the JWT from cookies and use it as the session identifier
 */

import { cookies } from 'next/headers';
import { createSession, updateSessionActivity } from './sessions';
import { getClientIP, getUserAgent } from './sessions';
import crypto from 'crypto';

/**
 * Get the session token (JWT) from NextAuth cookies
 * NextAuth v5 uses 'authjs.session-token' or '__Secure-authjs.session-token' (HTTPS)
 */
export async function getSessionTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  
  // Try different cookie names that NextAuth v5 might use
  const sessionToken =
    cookieStore.get('__Secure-authjs.session-token')?.value ||
    cookieStore.get('authjs.session-token')?.value ||
    cookieStore.get('__Secure-next-auth.session-token')?.value ||
    cookieStore.get('next-auth.session-token')?.value ||
    null;

  return sessionToken;
}

/**
 * Generate a stable session identifier from JWT token
 * We hash the JWT to create a stable identifier for our database
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Track session activity - call this on authenticated requests
 * This will create a session record if it doesn't exist, or update lastActiveAt
 */
export async function trackSessionActivity(userId: string): Promise<void> {
  try {
    const sessionToken = await getSessionTokenFromCookie();
    if (!sessionToken) {
      // No session token found, can't track
      return;
    }

    const hashedToken = hashSessionToken(sessionToken);
    const ipAddress = await getClientIP();
    const userAgent = await getUserAgent();

    // Try to update existing session first
    try {
      await updateSessionActivity(hashedToken);
    } catch {
      // Session doesn't exist yet, create it
      // This can happen on first request after login if the cookie wasn't available
      // during the initial login flow
      await createSession({
        userId,
        sessionToken: hashedToken, // Store hash in DB for consistency
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
      });
    }
  } catch (error) {
    // Silently fail - session tracking shouldn't break the app
    // Only log if it's not the expected "session not found" error
    if (error instanceof Error && !error.message.includes('Session not found')) {
      console.error('[Session Tracking] Failed to track session activity:', error);
    }
  }
}

/**
 * Create a session record after login
 * This should be called after successful authentication
 */
export async function createSessionAfterLogin(userId: string): Promise<void> {
  try {
    const sessionToken = await getSessionTokenFromCookie();
    if (!sessionToken) {
      console.warn('[Session Tracking] No session token found after login');
      return;
    }

    const hashedToken = hashSessionToken(sessionToken);
    const ipAddress = await getClientIP();
    const userAgent = await getUserAgent();

    await createSession({
      userId,
      sessionToken: hashedToken,
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
    });
  } catch (error) {
    // Log but don't fail - session creation is best effort
    console.error('[Session Tracking] Failed to create session after login:', error);
  }
}
