"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTicketPresence } from "@/lib/hooks/useTicketPresence";
import { Pencil, Eye } from "lucide-react";

interface PresenceAvatarsProps {
  ticketId: string;
  userId: string;
  userName: string;
}

export function PresenceAvatars({
  ticketId,
  userId,
  userName,
}: PresenceAvatarsProps) {
  const { viewers, hasOtherViewers, typingViewers } = useTicketPresence({
    ticketId,
    userId,
  });

  if (!hasOtherViewers) return null;

  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Generate avatar color based on userId
  const getAvatarColor = (id: string) => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-red-500",
      "bg-teal-500",
    ];
    const index = id
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  // Limit to showing 3 avatars + count
  const visibleViewers = viewers.slice(0, 3);
  const remainingCount = viewers.length - 3;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {visibleViewers.map((viewer) => (
          <Avatar
            key={viewer.userId}
            className={`h-6 w-6 border-2 border-background ${getAvatarColor(viewer.userId)}`}
            title={`${viewer.userId} (${viewer.action})`}
          >
            <AvatarFallback className="text-xs text-white font-medium">
              {getInitials(viewer.userId)}
            </AvatarFallback>
          </Avatar>
        ))}
        {remainingCount > 0 && (
          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background">
            +{remainingCount}
          </div>
        )}
      </div>

      <div className="flex flex-col text-xs">
        {typingViewers.length > 0 ? (
          <span className="text-amber-600 font-medium animate-pulse flex items-center gap-1">
            <Pencil className="w-3 h-3" />
            {typingViewers.length === 1
              ? "Someone is typing..."
              : `${typingViewers.length} people are typing...`}
          </span>
        ) : (
          <span className="text-muted-foreground flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {viewers.length === 1
              ? "1 person viewing"
              : `${viewers.length} people viewing`}
          </span>
        )}
      </div>
    </div>
  );
}
