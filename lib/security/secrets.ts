import crypto from "crypto";

export function constantTimeEquals(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  if (!left || !right) return false;

  const leftDigest = crypto.createHash("sha256").update(left).digest();
  const rightDigest = crypto.createHash("sha256").update(right).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
}

export function bearerTokenMatches(
  authHeader: string | null,
  expectedToken: string | undefined,
): boolean {
  if (!authHeader || !expectedToken) return false;
  return constantTimeEquals(authHeader, `Bearer ${expectedToken}`);
}

export function getRequiredSecret(
  name: string,
  options?: { developmentFallback?: string },
): string {
  const value = process.env[name];
  if (value) return value;

  if (process.env.NODE_ENV !== "production" && options?.developmentFallback) {
    return options.developmentFallback;
  }

  throw new Error(`${name} environment variable is not set`);
}
