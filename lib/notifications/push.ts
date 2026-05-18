import webpush from "web-push";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { userSessionsExtended } from "@/db/schema";
import type { NotificationType } from "./types";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:admin-crm@agrnetworks.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function sendPushNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return { sent: 0, skipped: true };
  }

  const subscriptions = await db.query.userSessionsExtended.findMany({
    where: and(
      eq(userSessionsExtended.userId, params.userId),
      eq(userSessionsExtended.isActive, true),
    ),
  });

  let sent = 0;
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        const data = JSON.parse(
          Buffer.from(subscription.sessionToken, "base64").toString("utf8"),
        ) as {
          endpoint?: string;
          keys?: { p256dh?: string; auth?: string };
        };

        if (!data.endpoint || !data.keys?.p256dh || !data.keys?.auth) return;

        await webpush.sendNotification(
          {
            endpoint: data.endpoint,
            keys: {
              p256dh: data.keys.p256dh,
              auth: data.keys.auth,
            },
          },
          JSON.stringify({
            title: params.title,
            body: params.message,
            url: params.link || "/",
            tag: `${params.type}:${Date.now()}`,
          }),
        );
        sent++;
      } catch (error) {
        console.error("[Push] Failed to send notification:", error);
      }
    }),
  );

  return { sent, skipped: false };
}
