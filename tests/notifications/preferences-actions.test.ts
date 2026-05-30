import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  notificationPreferences,
  platformAdmins,
  users,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/app/app/settings/notifications/actions";
import { getRequestContext } from "@/lib/auth/context";

vi.mock("@/lib/auth/context", () => ({
  getRequestContext: vi.fn(),
}));

const mockGetRequestContext = getRequestContext as ReturnType<typeof vi.fn>;

const run = process.env.DATABASE_URL ? describe : describe.skip;

function buildDefaultPrefs(
  overrides: Partial<typeof notificationPreferences.$inferInsert> = {},
): typeof notificationPreferences.$inferInsert {
  return {
    emailEnabled: true,
    emailTicketAssigned: true,
    emailTicketStatusChanged: false,
    emailCommentAdded: true,
    emailMention: true,
    emailSlaBreach: true,
    emailDigestFrequency: "daily",
    inappEnabled: true,
    inappTicketAssigned: true,
    inappTicketStatusChanged: true,
    inappCommentAdded: true,
    inappMention: true,
    inappSlaBreach: true,
    pushEnabled: false,
    pushTicketAssigned: false,
    pushTicketStatusChanged: false,
    pushCommentAdded: false,
    pushMention: false,
    pushSlaBreach: false,
    ...overrides,
  } as typeof notificationPreferences.$inferInsert;
}

run("notification preferences server actions", () => {
  beforeEach(async () => {
    if (!process.env.DATABASE_URL) return;
    // Clear any lingering test data
    await db.execute(
      sql.raw(`DELETE FROM notification_preferences WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'prefs-action-%');`),
    );
    await db.execute(
      sql.raw(`DELETE FROM users WHERE email LIKE 'prefs-action-%';`),
    );
    await db.execute(
      sql.raw(`DELETE FROM platform_admins WHERE email LIKE 'prefs-action-%';`),
    );
  });

  afterEach(async () => {
    if (!process.env.DATABASE_URL) return;
    await db.execute(
      sql.raw(`DELETE FROM notification_preferences WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'prefs-action-%');`),
    );
    await db.execute(
      sql.raw(`DELETE FROM users WHERE email LIKE 'prefs-action-%';`),
    );
    await db.execute(
      sql.raw(`DELETE FROM platform_admins WHERE email LIKE 'prefs-action-%';`),
    );
  });

  it("getNotificationPreferences returns the authenticated user's row", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: `prefs-action-user-${Date.now()}@example.com`,
        name: "Action User",
        isInternal: false,
      })
      .returning();

    await db.insert(notificationPreferences).values(
      buildDefaultPrefs({ userId: user.id, emailDigestFrequency: "weekly" }),
    );

    mockGetRequestContext.mockResolvedValue({
      user,
      isPlatformAdmin: false,
      platformAdmin: null,
    });

    const prefs = await getNotificationPreferences();
    expect(prefs).not.toBeNull();
    expect(prefs!.userId).toBe(user.id);
    expect(prefs!.platformAdminId).toBeNull();
    expect(prefs!.emailDigestFrequency).toBe("weekly");
  });

  it("getNotificationPreferences returns the authenticated platform admin's row", async () => {
    const [admin] = await db
      .insert(platformAdmins)
      .values({
        email: `prefs-action-admin-${Date.now()}@example.com`,
        name: "Action Admin",
        passwordHash: "test-hash",
        role: "SUPPORT",
        isActive: true,
      })
      .returning();

    await db.insert(notificationPreferences).values(
      buildDefaultPrefs({
        platformAdminId: admin.id,
        emailDigestFrequency: "daily",
      }),
    );

    mockGetRequestContext.mockResolvedValue({
      user: admin,
      isPlatformAdmin: true,
      platformAdmin: admin,
    });

    const prefs = await getNotificationPreferences();
    expect(prefs).not.toBeNull();
    expect(prefs!.platformAdminId).toBe(admin.id);
    expect(prefs!.userId).toBeNull();
    expect(prefs!.emailDigestFrequency).toBe("daily");
  });

  it("updateNotificationPreferences saves new values", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: `prefs-action-update-${Date.now()}@example.com`,
        name: "Update User",
        isInternal: false,
      })
      .returning();

    await db.insert(notificationPreferences).values(
      buildDefaultPrefs({ userId: user.id }),
    );

    mockGetRequestContext.mockResolvedValue({
      user,
      isPlatformAdmin: false,
      platformAdmin: null,
    });

    const result = await updateNotificationPreferences({
      emailEnabled: false,
      emailTicketAssigned: false,
      emailTicketStatusChanged: true,
      emailCommentAdded: false,
      emailMention: false,
      emailSlaBreach: false,
      emailDigestFrequency: "off",
      inappEnabled: true,
      inappTicketAssigned: true,
      inappTicketStatusChanged: true,
      inappCommentAdded: true,
      inappMention: true,
      inappSlaBreach: true,
      pushEnabled: false,
      pushTicketAssigned: false,
      pushTicketStatusChanged: false,
      pushCommentAdded: false,
      pushMention: false,
      pushSlaBreach: false,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.preferences.emailEnabled).toBe(false);
    expect(result.preferences.emailTicketAssigned).toBe(false);
    expect(result.preferences.emailTicketStatusChanged).toBe(true);
    expect(result.preferences.emailDigestFrequency).toBe("off");

    // Verify DB side
    const row = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, user.id),
    });
    expect(row!.emailEnabled).toBe(false);
    expect(row!.emailDigestFrequency).toBe("off");
  });

  it("updateNotificationPreferences validates digest frequency enum", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: `prefs-action-validate-${Date.now()}@example.com`,
        name: "Validate User",
        isInternal: false,
      })
      .returning();

    await db.insert(notificationPreferences).values(
      buildDefaultPrefs({ userId: user.id }),
    );

    mockGetRequestContext.mockResolvedValue({
      user,
      isPlatformAdmin: false,
      platformAdmin: null,
    });

    const result = await updateNotificationPreferences({
      emailEnabled: true,
      emailTicketAssigned: true,
      emailTicketStatusChanged: false,
      emailCommentAdded: true,
      emailMention: true,
      emailSlaBreach: true,
      emailDigestFrequency: "hourly" as any,
      inappEnabled: true,
      inappTicketAssigned: true,
      inappTicketStatusChanged: true,
      inappCommentAdded: true,
      inappMention: true,
      inappSlaBreach: true,
      pushEnabled: false,
      pushTicketAssigned: false,
      pushTicketStatusChanged: false,
      pushCommentAdded: false,
      pushMention: false,
      pushSlaBreach: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid preference data");
  });

  it("updateNotificationPreferences rejects unauthenticated requests", async () => {
    mockGetRequestContext.mockResolvedValue({
      user: null,
      isPlatformAdmin: false,
      platformAdmin: null,
    });

    await expect(
      updateNotificationPreferences({
        emailEnabled: true,
        emailTicketAssigned: true,
        emailTicketStatusChanged: false,
        emailCommentAdded: true,
        emailMention: true,
        emailSlaBreach: true,
        emailDigestFrequency: "daily",
        inappEnabled: true,
        inappTicketAssigned: true,
        inappTicketStatusChanged: true,
        inappCommentAdded: true,
        inappMention: true,
        inappSlaBreach: true,
        pushEnabled: false,
        pushTicketAssigned: false,
        pushTicketStatusChanged: false,
        pushCommentAdded: false,
        pushMention: false,
        pushSlaBreach: false,
      }),
    ).rejects.toThrow("Authentication required");
  });

  it("getNotificationPreferences cannot return another user's preferences", async () => {
    const [userA] = await db
      .insert(users)
      .values({
        email: `prefs-action-a-${Date.now()}@example.com`,
        name: "User A",
        isInternal: false,
      })
      .returning();

    const [userB] = await db
      .insert(users)
      .values({
        email: `prefs-action-b-${Date.now()}@example.com`,
        name: "User B",
        isInternal: false,
      })
      .returning();

    await db.insert(notificationPreferences).values(
      buildDefaultPrefs({ userId: userA.id, emailDigestFrequency: "daily" }),
    );

    await db.insert(notificationPreferences).values(
      buildDefaultPrefs({ userId: userB.id, emailDigestFrequency: "weekly" }),
    );

    // Authenticate as User A
    mockGetRequestContext.mockResolvedValue({
      user: userA,
      isPlatformAdmin: false,
      platformAdmin: null,
    });

    const prefs = await getNotificationPreferences();
    expect(prefs).not.toBeNull();
    expect(prefs!.userId).toBe(userA.id);
    expect(prefs!.emailDigestFrequency).toBe("daily");
  });

  it("updateNotificationPreferences cannot update another user's preferences", async () => {
    const [userA] = await db
      .insert(users)
      .values({
        email: `prefs-action-update-a-${Date.now()}@example.com`,
        name: "User A",
        isInternal: false,
      })
      .returning();

    const [userB] = await db
      .insert(users)
      .values({
        email: `prefs-action-update-b-${Date.now()}@example.com`,
        name: "User B",
        isInternal: false,
      })
      .returning();

    await db.insert(notificationPreferences).values(
      buildDefaultPrefs({ userId: userA.id, emailDigestFrequency: "daily" }),
    );

    await db.insert(notificationPreferences).values(
      buildDefaultPrefs({ userId: userB.id, emailDigestFrequency: "weekly" }),
    );

    // Authenticate as User A
    mockGetRequestContext.mockResolvedValue({
      user: userA,
      isPlatformAdmin: false,
      platformAdmin: null,
    });

    const result = await updateNotificationPreferences({
      emailEnabled: false,
      emailTicketAssigned: false,
      emailTicketStatusChanged: false,
      emailCommentAdded: false,
      emailMention: false,
      emailSlaBreach: false,
      emailDigestFrequency: "off",
      inappEnabled: true,
      inappTicketAssigned: true,
      inappTicketStatusChanged: true,
      inappCommentAdded: true,
      inappMention: true,
      inappSlaBreach: true,
      pushEnabled: false,
      pushTicketAssigned: false,
      pushTicketStatusChanged: false,
      pushCommentAdded: false,
      pushMention: false,
      pushSlaBreach: false,
    });

    expect(result.success).toBe(true);

    // Verify User A was updated
    const rowA = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, userA.id),
    });
    expect(rowA!.emailEnabled).toBe(false);
    expect(rowA!.emailDigestFrequency).toBe("off");

    // Verify User B was NOT changed
    const rowB = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, userB.id),
    });
    expect(rowB!.emailEnabled).toBe(true);
    expect(rowB!.emailDigestFrequency).toBe("weekly");
  });
});
