import { cookies } from "next/headers";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/db";
import { auditLogs, platformAdmins } from "@/db/schema";
import { eq } from "drizzle-orm";

export const IMPERSONATION_COOKIE = "atlas_impersonation";

export interface ImpersonationState {
  platformAdminId: string;
  orgId: string;
  userId: string;
  startedAt: string;
  expiresAt: string;
  reason: string;
}

function clientIpFromHeaders(headersList: Headers) {
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown"
  );
}

function ipMatchesRule(ip: string, rule: string) {
  if (rule === ip) return true;
  if (!rule.includes("/")) return false;

  const [base, bitsRaw] = rule.split("/");
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;

  const toInt = (value: string) =>
    value.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;

  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (toInt(ip) & mask) === (toInt(base) & mask);
}

export async function requirePlatformAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Platform admin authentication required");
  }

  /* eslint-disable no-restricted-syntax -- Platform admin authentication is global, not tenant-scoped. */
  const admin = await db.query.platformAdmins.findFirst({
    where: eq(platformAdmins.id, session.user.id),
  });
  /* eslint-enable no-restricted-syntax */

  if (!admin || !admin.isActive) {
    throw new Error("Platform admin access required");
  }

  const allowlist = admin.ipAllowlist || [];
  if (allowlist.length > 0) {
    const headersList = await headers();
    const ip = clientIpFromHeaders(headersList);
    if (!allowlist.some((rule) => ipMatchesRule(ip, rule))) {
      throw new Error("Platform admin IP allowlist denied this request");
    }
  }

  return admin;
}

export async function getImpersonationState(): Promise<ImpersonationState | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  if (!value) return null;

  try {
    const state = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as ImpersonationState;
    if (new Date(state.expiresAt).getTime() <= Date.now()) {
      await clearImpersonationState();
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

export async function setImpersonationState(
  state: ImpersonationState,
  durationMinutes = 30,
) {
  const cookieStore = await cookies();
  cookieStore.set(
    IMPERSONATION_COOKIE,
    Buffer.from(JSON.stringify(state), "utf8").toString("base64url"),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.min(Math.max(durationMinutes, 1), 60) * 60,
    },
  );
}

export async function clearImpersonationState() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);
}

export async function logPlatformAudit(input: {
  platformAdminId: string;
  orgId?: string | null;
  action:
    | "ORG_CREATED"
    | "ORG_UPDATED"
    | "ORG_DISABLED"
    | "ORG_ENABLED"
    | "ORG_DELETED";
  details: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    platformAdminId: input.platformAdminId,
    orgId: input.orgId || null,
    action: input.action,
    details: JSON.stringify(input.details),
  });
}
