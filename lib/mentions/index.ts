import { db } from '@/db';
import { users, userMentions } from '@/db/schema';
import { eq, ilike } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications/service';

/**
 * Search users for mentions
 */
export async function searchUsersForMentions(
  orgId: string,
  query: string,
  limit: number = 10
) {
  const matchedUsers = await db.query.users.findMany({
    where: ilike(users.name, `%${query}%`),
    limit,
    columns: {
      id: true,
      name: true,
      email: true,
    },
  });

  return matchedUsers;
}

/**
 * Parse mentions from text
 * Returns array of user IDs mentioned
 */
export function parseMentions(text: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[2]); // match[2] is the user ID
  }

  return mentions;
}

/**
 * Extract plain text from mention-formatted text
 * Converts "@[John Doe](user-id-123)" to "@John Doe"
 */
export function formatMentionsForDisplay(text: string): string {
  return text.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, '@$1');
}

/**
 * Create mention records and send notifications
 */
export async function processMentions({
  commentId,
  content,
  authorId,
  ticketId,
  ticketKey,
}: {
  commentId: string;
  content: string;
  authorId: string;
  ticketId: string;
  ticketKey: string;
}) {
  const mentionedUserIds = parseMentions(content);

  if (mentionedUserIds.length === 0) return;

  // Get author details for the notification
  const author = await db.query.users.findFirst({
    where: eq(users.id, authorId),
    columns: { name: true },
  });

  for (const mentionedUserId of mentionedUserIds) {
    // Don't notify self
    if (mentionedUserId === authorId) continue;

    // Create mention record
    try {
      await db.insert(userMentions).values({
        commentId,
        mentionedUserId,
      });
    } catch {
      // Mention already exists, skip
    }

    // Send notification
    await createNotification({
      userId: mentionedUserId,
      type: 'USER_MENTIONED',
      title: 'You were mentioned',
      message: `${author?.name || 'Someone'} mentioned you in ticket ${ticketKey}`,
      data: {
        ticketId,
        ticketKey,
        commentId,
      },
      link: `/app/tickets/${ticketId}`,
    });
  }
}
