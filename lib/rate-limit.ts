import { redis } from './redis';

export interface RateLimitOptions {
  identifier: string; // IP address, email, or user ID
  limit: number; // Maximum number of requests
  windowSeconds: number; // Time window in seconds
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Rate limit check using Redis
 * Uses a sliding window counter
 */
export async function checkRateLimit(
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { identifier, limit, windowSeconds } = options;
  const key = `rate_limit:${identifier}:${windowSeconds}`;
  
  try {
    // Get current count
    const count = await redis.get<number>(key);
    const currentCount = count || 0;

    if (currentCount >= limit) {
      // Get TTL to calculate reset time
      const ttl = await redis.ttl(key);
      const resetSeconds = ttl > 0 ? ttl : windowSeconds;
      const resetAt = new Date(Date.now() + resetSeconds * 1000);
      
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Increment counter
    const newCount = await redis.incr(key);
    
    // Set expiration on first increment
    if (newCount === 1) {
      await redis.expire(key, windowSeconds);
    }

    const remaining = Math.max(0, limit - newCount);
    const ttl = await redis.ttl(key);
    const resetSeconds = ttl > 0 ? ttl : windowSeconds;
    const resetAt = new Date(Date.now() + resetSeconds * 1000);

    return {
      allowed: true,
      remaining,
      resetAt,
    };
  } catch (error) {
    // If Redis fails, allow the request (fail open)
    console.error('Rate limit check failed:', error);
    return {
      allowed: true,
      remaining: limit,
      resetAt: new Date(Date.now() + windowSeconds * 1000),
    };
  }
}

/**
 * Get client IP address from request headers
 */
export function getClientIP(headers: Headers): string {
  // Check various headers for IP (common proxy headers)
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  return 'unknown';
}

