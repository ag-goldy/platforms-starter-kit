import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { notificationPreferences, notifications, users } from "@/db/schema";
import { verifyCronAuth } from "@/lib/auth/cron";
import { sendWithOutbox } from "@/lib/email/outbox";

const DIGEST_WINDOW_HOURS = 24;

export async function GET(request: NextRequest) {
  const rejection = verifyCronAuth(request);
  if (rejection) return rejection;

  const since = new Date(Date.now() - DIGEST_WINDOW_HOURS * 60 * 60 * 1000);

  const prefs = await db.query.notificationPreferences.findMany({
    where: and(
      eq(notificationPreferences.emailEnabled, true),
      inArray(notificationPreferences.emailDigestFrequency, [
        "daily",
        "weekly",
      ]),
    ),
  });

  const results = [];

  for (const pref of prefs) {
    if (!pref.userId) continue;

    const user = await db.query.users.findFirst({
      where: eq(users.id, pref.userId),
      columns: { email: true, name: true },
    });

    if (!user?.email) continue;

    const rows = await db.query.notifications.findMany({
      where: and(
        eq(notifications.userId, pref.userId),
        eq(notifications.read, false),
        gte(notifications.createdAt, since),
      ),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      limit: 25,
    });

    if (rows.length === 0) {
      results.push({ userId: pref.userId, sent: false, reason: "no_unread" });
      continue;
    }

    const items = rows
      .map(
        (notification) =>
          `<li><strong>${notification.title}</strong><br/>${notification.message}</li>`,
      )
      .join("");

    await sendWithOutbox({
      type: "email_digest",
      to: user.email,
      subject: `Atlas digest: ${rows.length} unread notification${rows.length === 1 ? "" : "s"}`,
      text: rows
        .map((notification) => `${notification.title}\n${notification.message}`)
        .join("\n\n"),
      html: `<p>Hello ${user.name || "there"},</p><p>Here are your unread Atlas notifications.</p><ul>${items}</ul>`,
    });

    results.push({ userId: pref.userId, sent: true, count: rows.length });
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}
