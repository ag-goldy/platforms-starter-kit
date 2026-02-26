/**
 * Ticket Presence Tracking - Real-time user activity on tickets
 * 
 * Uses Redis Hash with expiry to track who is viewing/editing tickets
 * Keys expire after 120 seconds of inactivity
 */

import { redis } from './client';

export type PresenceAction = 'viewing' | 'editing';

export interface UserPresence {
  userId: string;
  action: PresenceAction;
  since: Date;
}

const PRESENCE_TTL_SECONDS = 120;
const PRESENCE_PREFIX = 'presence:ticket:';

/**
 * Set user presence for a ticket
 * 
 * @param ticketId - Ticket ID
 * @param userId - User ID
 * @param action - 'viewing' or 'editing'
 */
export async function setPresence(
  ticketId: string,
  userId: string,
  action: PresenceAction
): Promise<void> {
  const key = `${PRESENCE_PREFIX}${ticketId}`;
  const value = JSON.stringify({ action, since: new Date().toISOString() });

  try {
    await redis.hset(key, userId, value);
    // Reset expiry on every update
    await redis.expire(key, PRESENCE_TTL_SECONDS);
  } catch (error) {
    console.warn(`[Presence] Failed to set presence for ticket ${ticketId}:`, error);
  }
}

/**
 * Get all active presence for a ticket
 * Filters out expired entries (Redis hash fields don't auto-expire,
 * so we check the timestamp and clean up stale entries)
 * 
 * @param ticketId - Ticket ID
 * @returns Array of active user presences
 */
export async function getPresence(ticketId: string): Promise<UserPresence[]> {
  const key = `${PRESENCE_PREFIX}${ticketId}`;

  try {
    const allPresence = await redis.hgetall<Record<string, string>>(key);
    if (!allPresence || Object.keys(allPresence).length === 0) {
      return [];
    }

    const now = Date.now();
    const cutoff = now - PRESENCE_TTL_SECONDS * 1000;
    const active: UserPresence[] = [];
    const staleUsers: string[] = [];

    for (const [userId, valueStr] of Object.entries(allPresence)) {
      try {
        const value = JSON.parse(valueStr) as { action: PresenceAction; since: string };
        const since = new Date(value.since).getTime();

        // Check if still active (within TTL)
        if (since > cutoff) {
          active.push({
            userId,
            action: value.action,
            since: new Date(value.since),
          });
        } else {
          staleUsers.push(userId);
        }
      } catch {
        // Invalid JSON - mark for cleanup
        staleUsers.push(userId);
      }
    }

    // Clean up stale entries (fire and forget)
    if (staleUsers.length > 0) {
      Promise.all(staleUsers.map(userId => redis.hdel(key, userId))).catch(() => {
        // Ignore cleanup errors
      });
    }

    return active;
  } catch (error) {
    console.warn(`[Presence] Failed to get presence for ticket ${ticketId}:`, error);
    return [];
  }
}

/**
 * Remove user presence for a ticket
 * Call this when user navigates away or closes the ticket
 * 
 * @param ticketId - Ticket ID
 * @param userId - User ID
 */
export async function removePresence(ticketId: string, userId: string): Promise<void> {
  const key = `${PRESENCE_PREFIX}${ticketId}`;

  try {
    await redis.hdel(key, userId);
  } catch (error) {
    console.warn(`[Presence] Failed to remove presence for ticket ${ticketId}:`, error);
  }
}

/**
 * Get presence for multiple tickets at once (for dashboard views)
 * 
 * @param ticketIds - Array of ticket IDs
 * @returns Map of ticketId -> presences
 */
export async function getPresenceForTickets(
  ticketIds: string[]
): Promise<Map<string, UserPresence[]>> {
  const result = new Map<string, UserPresence[]>();

  // Fetch in parallel
  await Promise.all(
    ticketIds.map(async (ticketId) => {
      const presence = await getPresence(ticketId);
      result.set(ticketId, presence);
    })
  );

  return result;
}

/**
 * Check if anyone is editing a ticket (for conflict prevention)
 * 
 * @param ticketId - Ticket ID
 * @param excludeUserId - User to exclude (the current user)
 * @returns User ID of editor if someone else is editing, null otherwise
 */
export async function getEditor(
  ticketId: string,
  excludeUserId?: string
): Promise<string | null> {
  const presences = await getPresence(ticketId);
  
  for (const presence of presences) {
    if (presence.action === 'editing' && presence.userId !== excludeUserId) {
      return presence.userId;
    }
  }
  
  return null;
}

/**
 * Subscribe to presence updates (for real-time UI updates)
 * Note: This is a placeholder for WebSocket/SSE integration
 * The actual implementation would use Redis Pub/Sub or WebSocket events
 */
export function subscribeToPresence(
  ticketId: string,
  callback: (presences: UserPresence[]) => void
): () => void {
  // Poll every 10 seconds for updates
  const interval = setInterval(async () => {
    const presences = await getPresence(ticketId);
    callback(presences);
  }, 10000);

  // Initial call
  getPresence(ticketId).then(callback);

  // Return unsubscribe function
  return () => clearInterval(interval);
}
