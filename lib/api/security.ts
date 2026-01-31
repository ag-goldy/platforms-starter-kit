/**
 * API endpoint security utilities
 * 
 * Provides consistent authentication and authorization for operational endpoints
 */

import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { requireInternalRole } from '@/lib/auth/permissions';
import { getCorrelationId } from '@/lib/monitoring/correlation';
import { trackError } from '@/lib/monitoring/error-tracking';

/**
 * Verify CRON secret from request headers
 * Returns true if valid, false otherwise
 */
export async function verifyCronSecret(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    // If no secret configured, allow in development
    return process.env.NODE_ENV !== 'production';
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Verify internal role authentication
 * Returns user if authenticated, throws error otherwise
 */
export async function verifyInternalAuth() {
  const session = await getServerSession();
  if (!session) {
    throw new Error('Unauthorized: No session');
  }
  
  return await requireInternalRole();
}

/**
 * Verify API secret from custom header
 */
export function verifyApiSecret(
  request: NextRequest,
  secretName: string,
  headerName: string = 'x-api-secret'
): boolean {
  const secret = process.env[secretName];
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  
  const headerValue = request.headers.get(headerName);
  return headerValue === secret;
}

/**
 * Log unauthorized access attempt with correlation ID
 */
export async function logUnauthorizedAccess(
  request: NextRequest,
  reason: string,
  endpoint: string
): Promise<void> {
  const correlationId = await getCorrelationId();
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  await trackError(new Error(`Unauthorized access attempt: ${reason}`), {
    correlationId,
    action: 'UNAUTHORIZED_ACCESS',
    endpoint,
    ip,
    userAgent,
  });
}

/**
 * Secure endpoint handler wrapper
 * Supports both CRON secret and internal auth
 */
export async function secureEndpoint(
  request: NextRequest,
  options: {
    allowCron?: boolean;
    requireInternal?: boolean;
    requireSecret?: string;
  } = {}
): Promise<{ authorized: boolean; user?: Awaited<ReturnType<typeof verifyInternalAuth>> }> {
  const { allowCron = true, requireInternal = false, requireSecret } = options;
  
  // Check CRON secret if allowed
  if (allowCron) {
    const cronValid = await verifyCronSecret(request);
    if (cronValid) {
      return { authorized: true };
    }
  }
  
  // Check custom secret if required
  if (requireSecret) {
    const secretValid = verifyApiSecret(request, requireSecret);
    if (secretValid) {
      return { authorized: true };
    }
  }
  
  // Check internal auth if required
  if (requireInternal) {
    try {
      const user = await verifyInternalAuth();
      return { authorized: true, user };
    } catch {
      // Will be handled below
    }
  }
  
  // Not authorized
  return { authorized: false };
}
