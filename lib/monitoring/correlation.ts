/**
 * Correlation ID utilities
 * 
 * Generates and manages correlation IDs for request tracing
 */

import { headers } from 'next/headers';

/**
 * Generate a new correlation ID
 * Edge-compatible UUID v4 generator (works in middleware)
 */
export function generateCorrelationId(): string {
  // Edge-compatible UUID v4 generator
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get correlation ID from request headers, or generate a new one
 */
export async function getCorrelationId(): Promise<string> {
  const headersList = await headers();
  const correlationId = headersList.get('x-correlation-id');
  return correlationId || generateCorrelationId();
}

/**
 * Get correlation ID from headers synchronously (for middleware)
 */
export function getCorrelationIdFromHeaders(headers: Headers): string {
  const correlationId = headers.get('x-correlation-id');
  return correlationId || generateCorrelationId();
}

/**
 * Add correlation ID to response headers
 */
export function addCorrelationIdHeader(headers: Headers, correlationId: string): void {
  headers.set('x-correlation-id', correlationId);
}

