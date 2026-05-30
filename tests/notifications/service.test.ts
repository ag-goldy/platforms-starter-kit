import { describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { notifications, platformAdmins, users } from "@/db/schema";
import { createNotification, createBulkNotifications } from "@/lib/notifications/service";
import { eq } from "drizzle-orm";

vi.mock("@/lib/redis", () => ({
  redis: {
    lpush: vi.fn(async () => 1),
    llen: vi.fn(async () => 0),
    rpop: vi.fn(async () => null),
  },
}));

vi.mock("@/lib/notifications/push", () => ({
  sendPushNotification: vi.fn(async () => ({ sent: 1, skipped: false })),
}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("notification service", () => {
  async function cleanup() {
    await db.execute(
      `DELETE FROM notifications WHERE title LIKE 'test-notif-%'` as any,
    );
    await db.execute(
      `DELETE FROM users WHERE email LIKE 'test-notif-%'` as any,
    );
    await db.execute(
      `DELETE FROM platform_admins WHERE email LIKE 'test-notif-%'` as any,
    );
  }

  describe("createNotification", () => {
    it("creates a notification for a user", async () => {
      await cleanup();

      const [user] = await db
        .insert(users)
        .values({
          email: `test-notif-user-${Date.now()}@example.com`,
          name: "Test User",
          isInternal: false,
        })
        .returning();

      const notif = await createNotification({
        userId: user.id,
        type: "TICKET_ASSIGNED",
        title: "test-notif-user",
        message: "You have a ticket",
      });

      expect(notif.userId).toBe(user.id);
      expect(notif.platformAdminId).toBeNull();
      expect(notif.title).toBe("test-notif-user");

      await cleanup();
    });

    it("creates a notification for a platform admin", async () => {
      await cleanup();

      const [admin] = await db
        .insert(platformAdmins)
        .values({
          email: `test-notif-admin-${Date.now()}@example.com`,
          name: "Test Admin",
          passwordHash: "test-hash",
          role: "SUPPORT",
          isActive: true,
        })
        .returning();

      const notif = await createNotification({
        platformAdminId: admin.id,
        type: "TICKET_ASSIGNED",
        title: "test-notif-admin",
        message: "You have a ticket",
      });

      expect(notif.platformAdminId).toBe(admin.id);
      expect(notif.userId).toBeNull();
      expect(notif.title).toBe("test-notif-admin");

      await cleanup();
    });

    it("throws when both userId and platformAdminId are provided", async () => {
      await expect(
        createNotification({
          userId: "00000000-0000-0000-0000-000000000001",
          platformAdminId: "00000000-0000-0000-0000-000000000002",
          type: "TICKET_ASSIGNED",
          title: "test-notif-both",
          message: "Bad",
        }),
      ).rejects.toThrow("Cannot specify both userId and platformAdminId");
    });

    it("throws when neither userId nor platformAdminId are provided", async () => {
      await expect(
        createNotification({
          type: "TICKET_ASSIGNED",
          title: "test-notif-neither",
          message: "Bad",
        }),
      ).rejects.toThrow("Must specify either userId or platformAdminId");
    });

    it("DB constraint rejects notification with both userId and platformAdminId", async () => {
      await cleanup();

      const [user] = await db
        .insert(users)
        .values({
          email: `test-notif-dbc-${Date.now()}@example.com`,
          name: "Test User",
          isInternal: false,
        })
        .returning();

      const [admin] = await db
        .insert(platformAdmins)
        .values({
          email: `test-notif-dbc-adm-${Date.now()}@example.com`,
          name: "Test Admin",
          passwordHash: "test-hash",
          role: "SUPPORT",
          isActive: true,
        })
        .returning();

      await expect(
        db.insert(notifications).values({
          userId: user.id,
          platformAdminId: admin.id,
          type: "TICKET_ASSIGNED",
          title: "test-notif-dbc-both",
          message: "Violation",
          read: false,
        }),
      ).rejects.toThrow();

      await cleanup();
    });

    it("DB constraint rejects notification with neither userId nor platformAdminId", async () => {
      await expect(
        db.insert(notifications).values({
          type: "TICKET_ASSIGNED",
          title: "test-notif-dbc-neither",
          message: "Violation",
          read: false,
        }),
      ).rejects.toThrow();
    });
  });

  describe("createBulkNotifications", () => {
    it("creates mixed user and admin notifications", async () => {
      await cleanup();

      const [user] = await db
        .insert(users)
        .values({
          email: `test-notif-bulk-user-${Date.now()}@example.com`,
          name: "Test User",
          isInternal: false,
        })
        .returning();

      const [admin] = await db
        .insert(platformAdmins)
        .values({
          email: `test-notif-bulk-admin-${Date.now()}@example.com`,
          name: "Test Admin",
          passwordHash: "test-hash",
          role: "SUPPORT",
          isActive: true,
        })
        .returning();

      const result = await createBulkNotifications([
        {
          userId: user.id,
          type: "TICKET_ASSIGNED",
          title: "test-notif-bulk-1",
          message: "User ticket",
        },
        {
          platformAdminId: admin.id,
          type: "TICKET_ASSIGNED",
          title: "test-notif-bulk-2",
          message: "Admin ticket",
        },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe(user.id);
      expect(result[1].platformAdminId).toBe(admin.id);

      await cleanup();
    });
  });
});
