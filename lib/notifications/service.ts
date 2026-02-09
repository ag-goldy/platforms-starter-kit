import { db } from '@/db';
import { notifications } from '@/db/schema';
import { redis } from '@/lib/redis';
import { NotificationType } from './types';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  link?: string;
}

/**
 * Publish notification to Redis for SSE delivery
 */
async function publishNotification(userId: string, notification: unknown) {
  const channel = `notifications:${userId}`;
  const message = JSON.stringify({
    type: 'notification',
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
    console.error('[NotificationService] Failed to publish to Redis:', error);
  }
}

/**
 * Create a notification for a user
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  data,
  link,
}: CreateNotificationParams) {
  const [notification] = await db
    .insert(notifications)
    .values({
      userId,
      type,
      title,
      message,
      data,
      link,
    })
    .returning();

  // Publish to Redis for real-time delivery
  await publishNotification(userId, notification);

  return notification;
}

/**
 * Create multiple notifications at once
 */
export async function createBulkNotifications(
  params: CreateNotificationParams[]
) {
  if (params.length === 0) return [];

  const notificationsList = await db
    .insert(notifications)
    .values(
      params.map((p) => ({
        userId: p.userId,
        type: p.type,
        title: p.title,
        message: p.message,
        data: p.data,
        link: p.link,
      }))
    )
    .returning();

  // Publish each notification to Redis for real-time delivery
  await Promise.all(
    notificationsList.map((notification) =>
      publishNotification(notification.userId, notification)
    )
  );

  return notificationsList;
}
