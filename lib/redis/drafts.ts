/**
 * Draft Autosave - Temporary storage for comment drafts
 * 
 * Saves unfinished comments to Redis with 24-hour TTL
 * Users can recover their draft when returning to a ticket
 */

import { redis } from './client';

const DRAFT_PREFIX = 'draft:';
const DRAFT_TTL_SECONDS = 86400; // 24 hours

export interface Draft {
  content: string;
  savedAt: Date;
}

/**
 * Save a draft for a ticket comment
 * 
 * @param userId - User ID
 * @param ticketId - Ticket ID
 * @param content - Draft content (HTML/markdown)
 */
export async function saveDraft(
  userId: string,
  ticketId: string,
  content: string
): Promise<void> {
  const key = `${DRAFT_PREFIX}${userId}:${ticketId}`;
  const draft: Draft = {
    content,
    savedAt: new Date(),
  };

  try {
    await redis.set(key, draft, { ex: DRAFT_TTL_SECONDS });
  } catch (error) {
    console.warn(`[Drafts] Failed to save draft for user ${userId} ticket ${ticketId}:`, error);
  }
}

/**
 * Get a saved draft
 * 
 * @param userId - User ID
 * @param ticketId - Ticket ID
 * @returns Draft content or null if not found/expired
 */
export async function getDraft(userId: string, ticketId: string): Promise<Draft | null> {
  const key = `${DRAFT_PREFIX}${userId}:${ticketId}`;

  try {
    const draft = await redis.get<Draft>(key);
    if (!draft) return null;
    
    // Convert savedAt string back to Date if needed
    if (typeof draft.savedAt === 'string') {
      draft.savedAt = new Date(draft.savedAt);
    }
    return draft;
  } catch (error) {
    console.warn(`[Drafts] Failed to get draft for user ${userId} ticket ${ticketId}:`, error);
    return null;
  }
}

/**
 * Delete a draft (call when comment is submitted)
 * 
 * @param userId - User ID
 * @param ticketId - Ticket ID
 */
export async function deleteDraft(userId: string, ticketId: string): Promise<void> {
  const key = `${DRAFT_PREFIX}${userId}:${ticketId}`;

  try {
    await redis.del(key);
  } catch (error) {
    console.warn(`[Drafts] Failed to delete draft for user ${userId} ticket ${ticketId}:`, error);
  }
}

/**
 * Get all drafts for a user (for "unsaved changes" indicator)
 * 
 * @param userId - User ID
 * @returns Map of ticketId -> draft
 */
export async function getAllDraftsForUser(userId: string): Promise<Map<string, Draft>> {
  const pattern = `${DRAFT_PREFIX}${userId}:*`;
  const drafts = new Map<string, Draft>();

  try {
    const keys = await redis.keys(pattern);
    
    for (const key of keys) {
      const draft = await redis.get<Draft>(key);
      if (draft) {
        // Extract ticketId from key (draft:userId:ticketId)
        const ticketId = key.split(':')[2];
        if (ticketId) {
          // Convert savedAt string back to Date if needed
          if (typeof draft.savedAt === 'string') {
            draft.savedAt = new Date(draft.savedAt);
          }
          drafts.set(ticketId, draft);
        }
      }
    }
  } catch (error) {
    console.warn(`[Drafts] Failed to get drafts for user ${userId}:`, error);
  }

  return drafts;
}

/**
 * Check if user has any unsaved drafts
 * 
 * @param userId - User ID
 * @returns Number of unsaved drafts
 */
export async function getDraftCount(userId: string): Promise<number> {
  const pattern = `${DRAFT_PREFIX}${userId}:*`;

  try {
    const keys = await redis.keys(pattern);
    return keys.length;
  } catch (error) {
    console.warn(`[Drafts] Failed to count drafts for user ${userId}:`, error);
    return 0;
  }
}

/**
 * Get draft age in human-readable format
 * 
 * @param savedAt - When the draft was saved
 * @returns Human-readable string (e.g., "2 hours ago")
 */
export function getDraftAge(savedAt: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - savedAt.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return 'over a day ago';
}
