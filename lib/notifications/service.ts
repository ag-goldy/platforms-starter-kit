import { db } from "@/db";
import { notifications } from "@/db/schema";
import { redis } from "@/lib/redis";
import { NotificationType } from "./types";
import { sendPushNotification } from "./push";

interface CreateNotificationParams {
  userId?: string;
  platformAdminId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  link?: string;
}

function validateRecipient(params: {
  userId?: string;
  platformAdminId?: string;
}) {
  const hasUser = Boolean(params.userId);
  const hasAdmin = Boolean(params.platformAdminId);
  if (hasUser && hasAdmin) {
    throw new Error(
      "Cannot specify both userId and platformAdminId for a notification",
    );
  }
  if (!hasUser && !hasAdmin) {
    throw new Error(
      "Must specify either userId or platformAdminId for a notification",
    );
  }
}

/**
 * Publish notification to Redis for SSE delivery
 */
async function publishNotification(userId: string, notification: unknown) {
  const channel = `notifications:${userId}`;
  const message = JSON.stringify({
    type: "notification",
    notification,
  });
  try {
    await redis.lpush(channel, message);
    // Keep only recent messages in the queue (last 100)
    const count = await redis.llen(channel);
    if (count > 100) {
      // Trim the list to keep only last 100 items
      // Note: This is a simple approach; in production you might want to use
      // a proper pub/sub mechanism or external message queue
      for (let i = 0; i < count - 100; i++) {
        await redis.rpop(channel);
      }
    }
  } catch (error) {
    console.error("[NotificationService] Failed to publish to Redis:", error);
  }
}

/**
 * Create a notification for a user or platform admin
 */
export async function createNotification({
  userId,
  platformAdminId,
  type,
  title,
  message,
  data,
  link,
}: CreateNotificationParams) {
  validateRecipient({ userId, platformAdminId });

  const [notification] = await db
    .insert(notifications)
    .values({
      userId,
      platformAdminId,
      type,
      title,
      message,
      data,
      link,
    })
    .returning();

  // Publish to Redis for real-time delivery (user notifications only)
  if (userId) {
    await publishNotification(userId, notification);
    await sendPushNotification({
      userId,
      type,
      title,
      message,
      link,
    });
  }

  return notification;
}

/**
 * Create multiple notifications at once
 */
export async function createBulkNotifications(
  params: CreateNotificationParams[],
) {
  if (params.length === 0) return [];

  for (const p of params) {
    validateRecipient(p);
  }

  const notificationsList = await db
    .insert(notifications)
    .values(
      params.map((p) => ({
        userId: p.userId,
        platformAdminId: p.platformAdminId,
        type: p.type,
        title: p.title,
        message: p.message,
        data: p.data,
        link: p.link,
      })),
    )
    .returning();

  // Publish each notification to Redis for real-time delivery (user notifications only)
  await Promise.all(
    notificationsList.map((notification) => {
      if (notification.userId) {
        return publishNotification(notification.userId, notification);
      }
      return Promise.resolve();
    }),
  );

  return notificationsList;
}
