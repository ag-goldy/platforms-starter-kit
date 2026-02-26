/**
 * Rate Limiting Utility using Redis
 * 
 * Implements sliding window rate limiting with Redis INCR + EXPIRE
 * Falls back to allowing requests if Redis is unavailable
 */

import { redis } from './client';

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

/**
 * Check and increment rate limit counter
 * Uses sliding window pattern: INCR key, EXPIRE if new, check against limit
 * 
 * @param key - Unique identifier for the rate limit (e.g., "email:user@example.com")
 * @param limit - Maximum number of requests allowed in the window
 * @param windowSeconds - Time window in seconds
 * @returns Rate limit result with success status and remaining count
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const redisKey = `ratelimit:${key}`;
  const now = Date.now();
  const resetAt = new Date(now + windowSeconds * 1000);

  try {
    // Get current count
    const current = await redis.incr(redisKey);
    
    // If this is the first request, set expiry
    if (current === 1) {
      await redis.expire(redisKey, windowSeconds);
    }

    // Check if over limit
    if (current > limit) {
      // Get TTL to return accurate reset time
      const ttl = await redis.ttl(redisKey);
      return {
        success: false,
        remaining: 0,
        resetAt: new Date(now + ttl * 1000),
        limit,
      };
    }

    return {
      success: true,
      remaining: limit - current,
      resetAt,
      limit,
    };
  } catch (error) {
    // Redis failure - allow request but log warning
    console.warn(`[RateLimit] Redis error for key "${key}":`, error);
    return {
      success: true, // Fail open - don't block on Redis errors
      remaining: 1,  // Assume we have requests remaining
      resetAt,
      limit,
    };
  }
}

/**
 * Rate limit by IP address
 * Useful for public endpoints
 */
export async function rateLimitByIp(
  ip: string,
  endpoint: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  return rateLimit(`ip:${endpoint}:${ip}`, limit, windowSeconds);
}

/**
 * Rate limit by user ID
 * Useful for authenticated endpoints
 */
export async function rateLimitByUser(
  userId: string,
  endpoint: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  return rateLimit(`user:${endpoint}:${userId}`, limit, windowSeconds);
}

/**
 * Rate limit by email (for email-specific limits)
 */
export async function rateLimitByEmail(
  email: string,
  action: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  // Normalize email to lowercase
  const normalizedEmail = email.toLowerCase();
  return rateLimit(`email:${action}:${normalizedEmail}`, limit, windowSeconds);
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(
  key: string,
  limit: number
): Promise<{ current: number; remaining: number; resetAt: Date | null }> {
  const redisKey = `ratelimit:${key}`;

  try {
    const current = Number(await redis.get(redisKey) ?? 0);
    const ttl = await redis.ttl(redisKey);
    
    return {
      current,
      remaining: Math.max(0, limit - current),
      resetAt: ttl > 0 ? new Date(Date.now() + ttl * 1000) : null,
    };
  } catch (error) {
    console.warn(`[RateLimit] Failed to get status for key "${key}":`, error);
    return {
      current: 0,
      remaining: limit,
      resetAt: null,
    };
  }
}

// Predefined rate limit configurations for common use cases
export const RATE_LIMITS = {
  // Inbound email webhook: 100 req/min per sender
  inboundEmail: (sender: string) => rateLimitByEmail(sender, 'inbound-email', 100, 60),
  
  // AI KB chat: 20 req/min per user
  aiChat: (userId: string) => rateLimitByUser(userId, 'kb-chat', 20, 60),
  
  // Public ticket creation: 10 req/min per IP
  publicTicket: (ip: string) => rateLimitByIp(ip, 'support', 10, 60),
  
  // Auth callback: 5 req/min per IP (brute force protection)
  authCallback: (ip: string) => rateLimitByIp(ip, 'auth-callback', 5, 60),
  
  // Login attempts: 5 req/min per email
  login: (email: string) => rateLimitByEmail(email, 'login', 5, 60),
  
  // Password reset: 3 req/hour per email
  passwordReset: (email: string) => rateLimitByEmail(email, 'password-reset', 3, 3600),
  
  // API general: 100 req/min per user
  api: (userId: string) => rateLimitByUser(userId, 'api', 100, 60),
  
  // Export generation: 5 req/hour per org
  export: (orgId: string) => rateLimit(`org:${orgId}:export`, 5, 3600),
} as const;
