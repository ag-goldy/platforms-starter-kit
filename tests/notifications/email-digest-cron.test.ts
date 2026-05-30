import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  emailOutbox,
  notificationPreferences,
  notifications,
  platformAdmins,
  users,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";

vi.mock("@/lib/auth/cron", () => ({
  verifyCronAuth: vi.fn(() => null),
}));

vi.mock("@/lib/email", () => ({
  emailService: {
    send: vi.fn(async () => ({})),
  },
}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("email digest cron", () => {
  const testEmails: string[] = [];
  let originalGetUTCDay: typeof Date.prototype.getUTCDay;

  beforeEach(() => {
    originalGetUTCDay = Date.prototype.getUTCDay;
  });

  afterEach(async () => {
    Date.prototype.getUTCDay = originalGetUTCDay;
    if (!process.env.DATABASE_URL) return;

    // Clean up outbox rows for test emails
    for (const email of testEmails) {
      await db.delete(emailOutbox).where(eq(emailOutbox.to, email));
    }
    testEmails.length = 0;

    // Clean up notification preferences, notifications, users, platform admins
    await db.execute(
      sql.raw(`
        DELETE FROM notification_preferences
        WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'digest-cron-%')
           OR platform_admin_id IN (SELECT id FROM platform_admins WHERE email LIKE 'digest-cron-%')
      `),
    );
    await db.execute(
      sql.raw(`DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'digest-cron-%') OR platform_admin_id IN (SELECT id FROM platform_admins WHERE email LIKE 'digest-cron-%');`),
    );
    await db.execute(
      sql.raw(`DELETE FROM users WHERE email LIKE 'digest-cron-%';`),
    );
    await db.execute(
      sql.raw(`DELETE FROM platform_admins WHERE email LIKE 'digest-cron-%';`),
    );
  });

  it("daily prefs fire on any day", async () => {
    Date.prototype.getUTCDay = function () {
      return 2; // Tuesday
    };

    const email = `digest-cron-daily-${Date.now()}@example.com`;
    testEmails.push(email);

    const [user] = await db
      .insert(users)
      .values({ email, name: "Daily User", isInternal: false })
      .returning();

    await db.insert(notificationPreferences).values({
      userId: user.id,
      emailEnabled: true,
      emailDigestFrequency: "daily",
    });

    await db.insert(notifications).values({
      userId: user.id,
      type: "TICKET_ASSIGNED",
      title: "Ticket assigned",
      message: "You have been assigned a ticket",
      read: false,
    });

    const { GET } = await import("@/app/api/cron/email-digest/route");
    const res = await GET(new Request("http://localhost/api/cron/email-digest") as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.processed.users).toBe(1);
    expect(body.sent).toBe(1);
    expect(body.skipped_no_unread).toBe(0);
    expect(body.skipped_weekly_not_today).toBe(0);

    const rows = await db.query.emailOutbox.findMany({
      where: eq(emailOutbox.to, email),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("email_digest");
    expect(rows[0].status).toBe("SENT");
  });

  it("weekly prefs fire only on Monday UTC", async () => {
    Date.prototype.getUTCDay = function () {
      return 2; // Tuesday
    };

    const email = `digest-cron-weekly-tue-${Date.now()}@example.com`;
    testEmails.push(email);

    const [user] = await db
      .insert(users)
      .values({ email, name: "Weekly User", isInternal: false })
      .returning();

    await db.insert(notificationPreferences).values({
      userId: user.id,
      emailEnabled: true,
      emailDigestFrequency: "weekly",
    });

    await db.insert(notifications).values({
      userId: user.id,
      type: "TICKET_ASSIGNED",
      title: "Ticket assigned",
      message: "You have been assigned a ticket",
      read: false,
    });

    const { GET } = await import("@/app/api/cron/email-digest/route");
    const res = await GET(new Request("http://localhost/api/cron/email-digest") as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.processed.users).toBe(1);
    expect(body.sent).toBe(0);
    expect(body.skipped_weekly_not_today).toBe(1);

    const rows = await db.query.emailOutbox.findMany({
      where: eq(emailOutbox.to, email),
    });
    expect(rows).toHaveLength(0);
  });

  it("weekly prefs fire on Monday UTC", async () => {
    Date.prototype.getUTCDay = function () {
      return 1; // Monday
    };

    const email = `digest-cron-weekly-mon-${Date.now()}@example.com`;
    testEmails.push(email);

    const [user] = await db
      .insert(users)
      .values({ email, name: "Weekly Mon User", isInternal: false })
      .returning();

    await db.insert(notificationPreferences).values({
      userId: user.id,
      emailEnabled: true,
      emailDigestFrequency: "weekly",
    });

    await db.insert(notifications).values({
      userId: user.id,
      type: "TICKET_ASSIGNED",
      title: "Ticket assigned",
      message: "You have been assigned a ticket",
      read: false,
    });

    const { GET } = await import("@/app/api/cron/email-digest/route");
    const res = await GET(new Request("http://localhost/api/cron/email-digest") as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.processed.users).toBe(1);
    expect(body.sent).toBe(1);
    expect(body.skipped_weekly_not_today).toBe(0);

    const rows = await db.query.emailOutbox.findMany({
      where: eq(emailOutbox.to, email),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("email_digest");
  });

  it("user and platform admin paths both work", async () => {
    Date.prototype.getUTCDay = function () {
      return 2; // Tuesday
    };

    const userEmail = `digest-cron-both-user-${Date.now()}@example.com`;
    const adminEmail = `digest-cron-both-admin-${Date.now()}@example.com`;
    testEmails.push(userEmail, adminEmail);

    const [user] = await db
      .insert(users)
      .values({ email: userEmail, name: "Both User", isInternal: false })
      .returning();

    const [admin] = await db
      .insert(platformAdmins)
      .values({
        email: adminEmail,
        name: "Both Admin",
        passwordHash: "test-hash",
        role: "SUPPORT",
        isActive: true,
      })
      .returning();

    await db.insert(notificationPreferences).values({
      userId: user.id,
      emailEnabled: true,
      emailDigestFrequency: "daily",
    });

    await db.insert(notificationPreferences).values({
      platformAdminId: admin.id,
      emailEnabled: true,
      emailDigestFrequency: "daily",
    });

    await db.insert(notifications).values({
      userId: user.id,
      type: "TICKET_ASSIGNED",
      title: "Ticket assigned",
      message: "You have been assigned a ticket",
      read: false,
    });

    await db.insert(notifications).values({
      platformAdminId: admin.id,
      type: "TICKET_ASSIGNED",
      title: "Ticket assigned",
      message: "You have been assigned a ticket",
      read: false,
    });

    const { GET } = await import("@/app/api/cron/email-digest/route");
    const res = await GET(new Request("http://localhost/api/cron/email-digest") as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.processed.users).toBe(1);
    expect(body.processed.admins).toBe(1);
    expect(body.sent).toBe(2); // both user and admin get email
    expect(body.skipped_no_unread).toBe(0);
  });

  it("empty unread list means no email sent", async () => {
    Date.prototype.getUTCDay = function () {
      return 2; // Tuesday
    };

    const email = `digest-cron-empty-${Date.now()}@example.com`;
    testEmails.push(email);

    const [user] = await db
      .insert(users)
      .values({ email, name: "Empty User", isInternal: false })
      .returning();

    await db.insert(notificationPreferences).values({
      userId: user.id,
      emailEnabled: true,
      emailDigestFrequency: "daily",
    });

    // No notifications inserted

    const { GET } = await import("@/app/api/cron/email-digest/route");
    const res = await GET(new Request("http://localhost/api/cron/email-digest") as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.processed.users).toBe(1);
    expect(body.sent).toBe(0);
    expect(body.skipped_no_unread).toBe(1);

    const rows = await db.query.emailOutbox.findMany({
      where: eq(emailOutbox.to, email),
    });
    expect(rows).toHaveLength(0);
  });

  it("email goes through sendWithOutbox (verify outbox row created)", async () => {
    Date.prototype.getUTCDay = function () {
      return 1; // Monday
    };

    const email = `digest-cron-outbox-${Date.now()}@example.com`;
    testEmails.push(email);

    const [user] = await db
      .insert(users)
      .values({ email, name: "Outbox User", isInternal: false })
      .returning();

    await db.insert(notificationPreferences).values({
      userId: user.id,
      emailEnabled: true,
      emailDigestFrequency: "daily",
    });

    await db.insert(notifications).values({
      userId: user.id,
      type: "TICKET_COMMENTED",
      title: "New comment",
      message: "A new comment was added",
      read: false,
    });

    const { GET } = await import("@/app/api/cron/email-digest/route");
    const res = await GET(new Request("http://localhost/api/cron/email-digest") as any);
    expect(res.status).toBe(200);

    const rows = await db.query.emailOutbox.findMany({
      where: eq(emailOutbox.to, email),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("email_digest");
    expect(rows[0].subject).toContain("daily notification digest");
    expect(rows[0].html).toContain("New comment");
    expect(rows[0].text).toContain("New comment");
    expect(rows[0].status).toBe("SENT");
  });
});
