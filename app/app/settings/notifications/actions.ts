"use server";

import { db } from "@/db";
import { notificationPreferences } from "@/db/schema";
import { requireAuth, AuthorizationError } from "@/lib/auth/permissions";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod/v3";

const updateSchema = z.object({
  emailEnabled: z.boolean(),
  emailTicketAssigned: z.boolean(),
  emailTicketStatusChanged: z.boolean(),
  emailCommentAdded: z.boolean(),
  emailMention: z.boolean(),
  emailSlaBreach: z.boolean(),
  emailDigestFrequency: z.enum(["off", "daily", "weekly"]),
  inappEnabled: z.boolean(),
  inappTicketAssigned: z.boolean(),
  inappTicketStatusChanged: z.boolean(),
  inappCommentAdded: z.boolean(),
  inappMention: z.boolean(),
  inappSlaBreach: z.boolean(),
  pushEnabled: z.boolean(),
  pushTicketAssigned: z.boolean(),
  pushTicketStatusChanged: z.boolean(),
  pushCommentAdded: z.boolean(),
  pushMention: z.boolean(),
  pushSlaBreach: z.boolean(),
});

export type UpdateNotificationPreferencesInput = z.infer<typeof updateSchema>;

/**
 * Get the current authenticated user/admin's notification preferences.
 * Returns null if no row exists (caller should handle fallback).
 */
export async function getNotificationPreferences() {
  const auth = await requireAuth();

  const isPlatformAdmin = auth.isPlatformAdmin;
  const ownerId = auth.user.id;

  if (isPlatformAdmin) {
    const prefs = await db.query.notificationPreferences.findFirst({
      where: and(
        eq(notificationPreferences.platformAdminId, ownerId),
        isNull(notificationPreferences.userId),
      ),
    });
    return prefs ?? null;
  }

  const prefs = await db.query.notificationPreferences.findFirst({
    where: and(
      eq(notificationPreferences.userId, ownerId),
      isNull(notificationPreferences.platformAdminId),
    ),
  });
  return prefs ?? null;
}

/**
 * Update the current authenticated user/admin's notification preferences.
 * Validates input with zod and verifies the row belongs to the caller.
 */
export async function updateNotificationPreferences(
  input: UpdateNotificationPreferencesInput,
) {
  const auth = await requireAuth();

  const parseResult = updateSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      error: "Invalid preference data",
      issues: parseResult.error.issues,
    };
  }

  const data = parseResult.data;
  const isPlatformAdmin = auth.isPlatformAdmin;
  const ownerId = auth.user.id;

  try {
    if (isPlatformAdmin) {
      const [updated] = await db
        .update(notificationPreferences)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(notificationPreferences.platformAdminId, ownerId),
            isNull(notificationPreferences.userId),
          ),
        )
        .returning();

      if (!updated) {
        return {
          success: false,
          error: "Notification preferences not found for platform admin",
        };
      }

      return { success: true, preferences: updated };
    }

    const [updated] = await db
      .update(notificationPreferences)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(notificationPreferences.userId, ownerId),
          isNull(notificationPreferences.platformAdminId),
        ),
      )
      .returning();

    if (!updated) {
      return {
        success: false,
        error: "Notification preferences not found for user",
      };
    }

    return { success: true, preferences: updated };
  } catch (err) {
    console.error("[Notifications] Failed to update preferences:", err);
    return {
      success: false,
      error: "Failed to update preferences",
    };
  }
}
