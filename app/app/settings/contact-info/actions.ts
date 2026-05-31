"use server";

import { db } from "@/db";
import { orgContactInfo, memberships } from "@/db/schema";
import {
  requireAuth,
  requireOrgRole,
  AuthorizationError,
} from "@/lib/auth/permissions";
import { getRequestContext } from "@/lib/auth/context";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod/v3";

const updateSchema = z.object({
  supportPhone: z
    .string()
    .max(50, "Phone number must be 50 characters or less")
    .transform((v) => v.trim() || null)
    .nullable()
    .optional(),
  supportEmail: z
    .string()
    .email("Invalid email address")
    .max(200, "Email must be 200 characters or less")
    .transform((v) => v.trim() || null)
    .nullable()
    .optional(),
  supportUrl: z
    .string()
    .max(200, "URL must be 200 characters or less")
    .refine(
      (v) => !v || v.startsWith("http://") || v.startsWith("https://"),
      "URL must start with http:// or https://",
    )
    .transform((v) => v.trim() || null)
    .nullable()
    .optional(),
});

export type UpdateOrgContactInfoInput = z.infer<typeof updateSchema>;

/**
 * Resolve orgId for contact info settings.
 * Prefers subdomain-resolved org from request context.
 * Falls back to the user's oldest active membership.
 */
async function resolveOrgIdForContactInfo(): Promise<string> {
  const context = await getRequestContext();

  // If subdomain resolved an org, use it
  if (context.org?.id) {
    return context.org.id;
  }

  // Fallback: look up the user's oldest active membership
  if (context.user) {
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, context.user.id),
        eq(memberships.isActive, true),
      ),
      orderBy: [asc(memberships.createdAt)],
    });

    if (membership?.orgId) {
      return membership.orgId;
    }
  }

  throw new AuthorizationError("No organization context available");
}

/**
 * Get the current authenticated user's org contact info.
 * Returns a default shape if no row exists.
 */
export async function getOrgContactInfo() {
  await requireAuth();
  const orgId = await resolveOrgIdForContactInfo();
  await requireOrgRole(orgId, ["ADMIN", "CUSTOMER_ADMIN"]);

  const row = await db.query.orgContactInfo.findFirst({
    where: eq(orgContactInfo.orgId, orgId),
  });

  if (!row) {
    return {
      orgId,
      supportPhone: null as string | null,
      supportEmail: null as string | null,
      supportUrl: null as string | null,
      createdAt: null as Date | null,
      updatedAt: null as Date | null,
    };
  }

  return row;
}

/**
 * Update the current authenticated user's org contact info.
 * Validates input with zod and performs an UPSERT.
 */
export async function updateOrgContactInfo(input: UpdateOrgContactInfoInput) {
  await requireAuth();
  const orgId = await resolveOrgIdForContactInfo();
  await requireOrgRole(orgId, ["ADMIN", "CUSTOMER_ADMIN"]);

  // Sanitize empty strings to null before validation
  const sanitized = {
    supportPhone:
      input.supportPhone === "" ? null : input.supportPhone,
    supportEmail:
      input.supportEmail === "" ? null : input.supportEmail,
    supportUrl: input.supportUrl === "" ? null : input.supportUrl,
  };

  const parseResult = updateSchema.safeParse(sanitized);
  if (!parseResult.success) {
    return {
      success: false as const,
      error: "Invalid contact info data",
      issues: parseResult.error.issues,
    };
  }

  const data = parseResult.data;

  try {
    const [row] = await db
      .insert(orgContactInfo)
      .values({
        orgId,
        supportPhone: data.supportPhone ?? null,
        supportEmail: data.supportEmail ?? null,
        supportUrl: data.supportUrl ?? null,
      })
      .onConflictDoUpdate({
        target: orgContactInfo.orgId,
        set: {
          supportPhone: data.supportPhone ?? null,
          supportEmail: data.supportEmail ?? null,
          supportUrl: data.supportUrl ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return { success: true as const, contactInfo: row };
  } catch (err) {
    console.error("[Contact Info] Failed to update:", err);
    return {
      success: false as const,
      error: "Failed to update contact info",
    };
  }
}
