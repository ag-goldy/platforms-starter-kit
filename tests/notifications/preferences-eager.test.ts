import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  notificationPreferences,
  platformAdmins,
  users,
} from "@/db/schema";
import {
  ensureNotificationPreferencesForPlatformAdmin,
  ensureNotificationPreferencesForUser,
} from "@/lib/notifications/preferences";

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("notification preference eager creation", () => {
  it("creates default preferences for a new user", async () => {
    const email = `prefs-${randomUUID()}@example.com`;
    const [user] = await db
      .insert(users)
      .values({
        email,
        name: "Preference User",
        isInternal: false,
      })
      .returning();

    await ensureNotificationPreferencesForUser(user.id);

    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, user.id));

    expect(prefs).toMatchObject({
      userId: user.id,
      platformAdminId: null,
      emailEnabled: true,
      emailTicketAssigned: true,
      emailTicketStatusChanged: false,
      emailCommentAdded: true,
      emailMention: true,
      emailSlaBreach: true,
      emailDigestFrequency: "daily",
      inappEnabled: true,
      pushEnabled: false,
    });
  });

  it("uses ON CONFLICT DO NOTHING for repeated user preference creation", async () => {
    const email = `prefs-repeat-${randomUUID()}@example.com`;
    const [user] = await db
      .insert(users)
      .values({
        email,
        name: "Repeated Preference User",
        isInternal: false,
      })
      .returning();

    await ensureNotificationPreferencesForUser(user.id);
    await ensureNotificationPreferencesForUser(user.id);

    const rows = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, user.id));

    expect(rows).toHaveLength(1);
  });

  it("creates default preferences for a new platform admin", async () => {
    const email = `platform-prefs-${randomUUID()}@example.com`;
    const [admin] = await db
      .insert(platformAdmins)
      .values({
        email,
        name: "Preference Admin",
        passwordHash: "test-password-hash",
        role: "SUPPORT",
        isActive: true,
      })
      .returning();

    try {
      await ensureNotificationPreferencesForPlatformAdmin(admin.id);

      const [prefs] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.platformAdminId, admin.id));

      expect(prefs).toMatchObject({
        userId: null,
        platformAdminId: admin.id,
        emailEnabled: true,
        emailDigestFrequency: "daily",
        inappEnabled: true,
        pushEnabled: false,
      });
    } finally {
      await db
        .delete(notificationPreferences)
        .where(eq(notificationPreferences.platformAdminId, admin.id));
      await db.delete(platformAdmins).where(eq(platformAdmins.id, admin.id));
    }
  });

  it("does not throw when the preference insert fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      ensureNotificationPreferencesForUser("not-a-real-user-id", {
        execute: async () => {
          throw new Error("insert failed");
        },
      }),
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith(
      "[Notifications] Failed to ensure preference row",
      expect.objectContaining({
        ownerType: "user",
        ownerId: "not-a-real-user-id",
      }),
    );

    consoleError.mockRestore();
  });

  it("wires eager creation into all active user creation paths", () => {
    const expectedHookSites = [
      "lib/users/invitations.ts",
      "app/app/actions/users.ts",
      "app/app/actions/organizations.ts",
      "app/api/ai/kb-chat/route.ts",
    ];

    const occurrences = expectedHookSites.reduce((count, file) => {
      const source = readFileSync(file, "utf8");
      return (
        count +
        source.split("ensureNotificationPreferencesForUser(").length -
        1
      );
    }, 0);

    expect(occurrences).toBe(5);
  });

  it("wires eager creation into the active platform admin creation path", () => {
    const source = readFileSync("app/api/setup/bootstrap-admin/route.ts", "utf8");

    expect(source).toContain(
      "ensureNotificationPreferencesForPlatformAdmin(admin.id)",
    );
  });
});
