/**
 * Hook for real-time ticket presence tracking
 *
 * Uses polling with presence updates to show other viewers
 * and detect potential edit collisions
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  setPresence,
  removePresence,
  getPresence,
  subscribeToPresence,
  type UserPresence,
} from "@/lib/redis/presence";

interface UseTicketPresenceOptions {
  ticketId: string;
  userId: string;
  enabled?: boolean;
}

interface Viewer {
  userId: string;
  action: "viewing" | "editing" | "typing";
  since: Date;
}

export function useTicketPresence({
  ticketId,
  userId,
  enabled = true,
}: UseTicketPresenceOptions) {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [lastCommentCount, setLastCommentCount] = useState(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Register presence on mount
  useEffect(() => {
    if (!enabled || !ticketId || !userId) return;

    // Set initial presence as viewing
    setPresence(ticketId, userId, "viewing");

    // Heartbeat every 30 seconds to keep presence alive
    heartbeatRef.current = setInterval(() => {
      setPresence(ticketId, userId, isTyping ? "typing" : "viewing");
    }, 30000);

    // Cleanup on unmount
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      removePresence(ticketId, userId);
    };
  }, [ticketId, userId, enabled, isTyping]);

  // Subscribe to other viewers
  useEffect(() => {
    if (!enabled || !ticketId) return;

    const unsubscribe = subscribeToPresence(ticketId, (presences) => {
      // Filter out current user
      const otherViewers = presences
        .filter((p) => p.userId !== userId)
        .map((p) => ({
          userId: p.userId,
          action: p.action,
          since: p.since,
        }));
      setViewers(otherViewers);
    });

    return unsubscribe;
  }, [ticketId, userId, enabled]);

  // Set typing status
  const setTyping = useCallback(
    (typing: boolean) => {
      if (!enabled || !ticketId || !userId) return;

      setIsTyping(typing);
      setPresence(ticketId, userId, typing ? "typing" : "viewing");

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Auto-clear typing after 5 seconds of inactivity
      if (typing) {
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          setPresence(ticketId, userId, "viewing");
        }, 5000);
      }
    },
    [ticketId, userId, enabled],
  );

  // Check for simultaneous replies (call before submitting)
  const checkForCollision = useCallback(
    async (
      currentCommentCount: number,
    ): Promise<{ hasCollision: boolean; newComments: number }> => {
      if (!enabled) return { hasCollision: false, newComments: 0 };

      // Get current presence
      const presences = await getPresence(ticketId);
      const otherEditors = presences.filter(
        (p) => p.userId !== userId && p.action === "editing",
      );

      // Check if comment count changed
      const newComments = currentCommentCount - lastCommentCount;

      if (newComments > 0 || otherEditors.length > 0) {
        setLastCommentCount(currentCommentCount);
        return { hasCollision: true, newComments };
      }

      return { hasCollision: false, newComments: 0 };
    },
    [ticketId, userId, enabled, lastCommentCount],
  );

  // Update last comment count
  const updateCommentCount = useCallback((count: number) => {
    setLastCommentCount(count);
  }, []);

  return {
    viewers,
    isTyping,
    setTyping,
    checkForCollision,
    updateCommentCount,
    hasOtherViewers: viewers.length > 0,
    hasOtherEditors: viewers.some(
      (v) => v.action === "editing" || v.action === "typing",
    ),
    typingViewers: viewers.filter((v) => v.action === "typing"),
  };
}
