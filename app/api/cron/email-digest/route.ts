import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  notificationPreferences,
  notifications,
  users,
  platformAdmins,
} from "@/db/schema";
import { sendWithOutbox } from "@/lib/email/outbox";
import { verifyCronAuth } from "@/lib/auth/cron";
import { eq, and, isNull, gt, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DigestResult = {
  processed: { users: number; admins: number };
  sent: number;
  skippedNoUnread: number;
  skippedWeeklyNotToday: number;
};

export async function GET(request: NextRequest) {
  const rejection = verifyCronAuth(request);
  if (rejection) return rejection;

  const now = new Date();
  const utcDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday

  const result: DigestResult = {
    processed: { users: 0, admins: 0 },
    sent: 0,
    skippedNoUnread: 0,
    skippedWeeklyNotToday: 0,
  };

  try {
    // ── User preferences ──
    const userPrefs = await db
      .select({
        prefId: notificationPreferences.id,
        userId: notificationPreferences.userId,
        frequency: notificationPreferences.emailDigestFrequency,
      })
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.emailEnabled, true),
          sql`${notificationPreferences.emailDigestFrequency} IN ('daily', 'weekly')`,
          isNull(notificationPreferences.platformAdminId),
        ),
      );

    for (const pref of userPrefs) {
      if (!pref.userId) continue;
      result.processed.users++;

      if (pref.frequency === "weekly" && utcDay !== 1) {
        result.skippedWeeklyNotToday++;
        continue;
      }

      const hours = pref.frequency === "weekly" ? 168 : 24;
      const unread = await getUnreadNotifications("user", pref.userId, hours);

      if (unread.length === 0) {
        result.skippedNoUnread++;
        continue;
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, pref.userId),
        columns: { email: true, name: true },
      });

      if (!user?.email) {
        result.skippedNoUnread++;
        continue;
      }

      const { subject, html, text } = buildDigestEmail(
        user.name,
        unread,
        pref.frequency,
      );
      await sendWithOutbox({
        type: "email_digest",
        to: user.email,
        subject,
        html,
        text,
      });
      result.sent++;
    }

    // ── Platform admin preferences ──
    const adminPrefs = await db
      .select({
        prefId: notificationPreferences.id,
        platformAdminId: notificationPreferences.platformAdminId,
        frequency: notificationPreferences.emailDigestFrequency,
      })
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.emailEnabled, true),
          sql`${notificationPreferences.emailDigestFrequency} IN ('daily', 'weekly')`,
          isNull(notificationPreferences.userId),
        ),
      );

    for (const pref of adminPrefs) {
      if (!pref.platformAdminId) continue;
      result.processed.admins++;

      if (pref.frequency === "weekly" && utcDay !== 1) {
        result.skippedWeeklyNotToday++;
        continue;
      }

      const hours = pref.frequency === "weekly" ? 168 : 24;
      const unread = await getUnreadNotifications(
        "admin",
        pref.platformAdminId,
        hours,
      );

      if (unread.length === 0) {
        result.skippedNoUnread++;
        continue;
      }

      const admin = await db.query.platformAdmins.findFirst({
        where: eq(platformAdmins.id, pref.platformAdminId),
        columns: { email: true, name: true },
      });

      if (!admin?.email) {
        result.skippedNoUnread++;
        continue;
      }

      const { subject, html, text } = buildDigestEmail(
        admin.name,
        unread,
        pref.frequency,
      );
      await sendWithOutbox({
        type: "email_digest",
        to: admin.email,
        subject,
        html,
        text,
      });
      result.sent++;
    }

    return NextResponse.json({
      ok: true,
      processed: result.processed,
      sent: result.sent,
      skipped_no_unread: result.skippedNoUnread,
      skipped_weekly_not_today: result.skippedWeeklyNotToday,
    });
  } catch (error) {
    console.error("[Cron] Email digest failed:", error);
    return NextResponse.json(
      { error: "Failed to process email digests" },
      { status: 500 },
    );
  }
}

async function getUnreadNotifications(
  ownerType: "user" | "admin",
  ownerId: string,
  hours: number,
) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const ownerFilter =
    ownerType === "user"
      ? eq(notifications.userId, ownerId)
      : eq(notifications.platformAdminId, ownerId);

  return db
    .select({
      id: notifications.id,
      title: notifications.title,
      message: notifications.message,
      createdAt: notifications.createdAt,
      link: notifications.link,
    })
    .from(notifications)
    .where(
      and(
        ownerFilter,
        eq(notifications.read, false),
        gt(notifications.createdAt, since),
      ),
    )
    .orderBy(sql`${notifications.createdAt} DESC`);
}

function buildDigestEmail(
  name: string | null,
  unread: Array<{
    id: string;
    title: string;
    message: string;
    createdAt: Date;
    link: string | null;
  }>,
  frequency: string,
) {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  const frequencyLabel = frequency === "weekly" ? "weekly" : "daily";
  const subject = `Your ${frequencyLabel} notification digest`;

  const htmlItems = unread
    .map((n) => {
      const date = n.createdAt.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const linkHtml = n.link
        ? `<br/><a href="${n.link}" style="color:#2563eb;">View →</a>`
        : "";
      return `<li style="margin-bottom:12px;">
        <strong>${escapeHtml(n.title)}</strong> <span style="color:#6b7280;">(${date})</span><br/>
        ${escapeHtml(n.message)}${linkHtml}
      </li>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;color:#111827;max-width:600px;margin:24px auto;">
  <p>${greeting}</p>
  <p>You have <strong>${unread.length}</strong> unread notification${unread.length === 1 ? "" : "s"}.</p>
  <ul style="padding-left:20px;">${htmlItems}</ul>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
  <p style="font-size:12px;color:#6b7280;">Atlas Helpdesk — ${frequencyLabel} digest</p>
</body>
</html>`;

  const textItems = unread
    .map((n) => {
      const date = n.createdAt.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const linkText = n.link ? `\n  Link: ${n.link}` : "";
      return `- ${n.title} (${date})\n  ${n.message}${linkText}`;
    })
    .join("\n\n");

  const text = `${greeting}\n\nYou have ${unread.length} unread notification${unread.length === 1 ? "" : "s"}.\n\n${textItems}\n\n---\nAtlas Helpdesk — ${frequencyLabel} digest`;

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
