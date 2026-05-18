"use client";

import { useSocketRealtime } from "@/hooks/use-socket-realtime";

export function RealtimeStatus({
  orgId,
  channel = "tickets",
}: {
  orgId: string;
  channel?: string;
}) {
  const { status } = useSocketRealtime({
    orgId,
    channel,
    events: ["ticket.created", "ticket.replied", "ticket.updated"],
    onEvent: () => {
      // Page-specific components can subscribe separately. This keeps the
      // portal connection warm and exposes connection state in the shell.
    },
  });

  return (
    <span className="hidden items-center gap-2 text-xs text-gray-500 sm:inline-flex">
      <span
        className={
          status === "connected"
            ? "h-2 w-2 rounded-full bg-emerald-500"
            : status === "fallback"
              ? "h-2 w-2 rounded-full bg-amber-500"
              : "h-2 w-2 rounded-full bg-gray-300"
        }
      />
      {status === "connected"
        ? "Live"
        : status === "fallback"
          ? "Live fallback"
          : "Offline"}
    </span>
  );
}
