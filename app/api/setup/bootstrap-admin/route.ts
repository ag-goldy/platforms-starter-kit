import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v3";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@/db";
import { platformAdmins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { bearerTokenMatches } from "@/lib/security/secrets";
import { ensureNotificationPreferencesForPlatformAdmin } from "@/lib/notifications/preferences";

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "SUPPORT"]).optional(),
});

function verifyBootstrapAuth(request: NextRequest): NextResponse | null {
  const token = process.env.BOOTSTRAP_ADMIN_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Bootstrap endpoint not configured" },
      { status: 503 },
    );
  }
  const authHeader = request.headers.get("authorization");
  if (!bearerTokenMatches(authHeader, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const rejection = verifyBootstrapAuth(request);
  if (rejection) return rejection;

  const allowOverride = process.env.ALLOW_BOOTSTRAP_ADMIN === "true";

  const anyAdmin = await db.query.platformAdmins.findFirst({
    columns: { id: true },
  });

  if (anyAdmin && !allowOverride) {
    return NextResponse.json(
      { error: "Bootstrap disabled (admin already exists)" },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  const name = parsed.data.name ?? "Platform Admin";
  const role = parsed.data.role ?? "SUPER_ADMIN";

  const existing = await db.query.platformAdmins.findFirst({
    where: eq(platformAdmins.email, normalizedEmail),
    columns: { id: true },
  });

  if (existing) {
    await db
      .update(platformAdmins)
      .set({
        name,
        role,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(platformAdmins.id, existing.id));

    return NextResponse.json({
      success: true,
      created: false,
      email: normalizedEmail,
    });
  }

  const temporaryPassword = crypto.randomBytes(32).toString("base64url");
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  const [admin] = await db
    .insert(platformAdmins)
    .values({
      email: normalizedEmail,
      name,
      passwordHash,
      role,
      isActive: true,
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: platformAdmins.id });

  if (admin) {
    await ensureNotificationPreferencesForPlatformAdmin(admin.id);
  }

  return NextResponse.json({
    success: true,
    created: true,
    email: normalizedEmail,
  });
}
