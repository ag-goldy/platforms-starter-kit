import { NextRequest, NextResponse } from "next/server";
import { bearerTokenMatches } from "@/lib/security/secrets";

/**
 * verifyCronAuth — shared fail-closed cron authentication.
 *
 * Expects: Authorization: Bearer <CRON_SECRET>
 *
 * Fail-closed contract:
 *   - If CRON_SECRET is not configured → reject 503 (misconfigured, not attacker-supplied)
 *   - If header missing or wrong value  → reject 401
 *   - Returns null when the request is authorized (caller continues normally)
 *   - Returns a NextResponse when the request must be rejected (caller must return it)
 *
 * Usage:
 *   const rejection = verifyCronAuth(request);
 *   if (rejection) return rejection;
 */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;

  // Fail-closed: if the secret is not configured, reject all cron requests.
  // This prevents an unconfigured deployment from executing cron jobs as if they were authenticated.
  if (!cronSecret) {
    console.error(
      "[SECURITY] CRON_SECRET is not configured — rejecting all cron requests",
    );
    return NextResponse.json(
      { error: "Cron endpoint not configured" },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (!bearerTokenMatches(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // authorized
}
