import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/auth/context";

/**
 * Shared auth guard for statuspage API routes.
 *
 * Enforces:
 * 1. Internal user or platform admin (cheap role check)
 * 2. Organization context present (request shape validation)
 * 3. Resolvable user ID
 * 4. Org-level permission check via the supplied callback (expensive DB call, last)
 */
export async function requireStatuspageAccess(
  permissionCheck: (userId: string, orgId: string) => Promise<boolean>,
): Promise<
  | { allowed: true; orgId: string; userId: string }
  | { allowed: false; response: NextResponse }
> {
  const context = await getRequestContext();

  // Internal feature: require internal user or platform admin
  if (!context.isPlatformAdmin && !context.user?.isInternal) {
    return {
      allowed: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (!context.orgId) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "Bad Request: org context required" },
        { status: 400 },
      ),
    };
  }

  const userId = context.user?.id ?? context.platformAdmin?.id;
  if (!userId) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  const canManage = await permissionCheck(userId, context.orgId);
  if (!canManage) {
    return {
      allowed: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { allowed: true, orgId: context.orgId, userId };
}
