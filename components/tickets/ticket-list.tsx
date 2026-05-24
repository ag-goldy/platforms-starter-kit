"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Ticket } from "@/db/schema";
import { BulkActions } from "./bulk-actions";
import { formatDate } from "@/lib/utils/date";
import { SearchHighlight } from "./search-highlight";
import { Clock3 } from "lucide-react";
import {
  EmptyTickets,
  EmptySearch,
  EmptyFilters,
} from "@/components/ui/empty-state";
import { TicketListSkeleton } from "@/components/ui/skeleton";

interface TicketListProps {
  tickets: (Ticket & {
    organization: { name: string } | null;
    requester: { name: string | null; email: string } | null;
    requesterEmail?: string | null;
    assignee: { id: string; name: string | null; email: string } | null;
    tagAssignments?: Array<{
      tag: { id: string; name: string; color: string | null };
    }>;
  })[];
  basePath?: string;
  internalUsers?: { id: string; name: string | null; email: string }[];
  searchTerm?: string;
  currentUserId?: string;
  isLoading?: boolean;
  hasFilters?: boolean;
  onClearFilters?: () => void;
}

export function TicketList({
  tickets,
  basePath = "/app/tickets",
  internalUsers,
  searchTerm,
  currentUserId,
  isLoading,
  hasFilters,
  onClearFilters,
}: TicketListProps) {
  const router = useRouter();
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(
    new Set(),
  );

  const toggleSelection = (ticketId: string) => {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTicketIds.size === tickets.length) {
      setSelectedTicketIds(new Set());
    } else {
      setSelectedTicketIds(new Set(tickets.map((t) => t.id)));
    }
  };

  // Loading state
  if (isLoading) {
    return <TicketListSkeleton count={5} />;
  }

  // Empty states
  if (tickets.length === 0) {
    // Search returned no results
    if (searchTerm) {
      return (
        <EmptySearch query={searchTerm} onClear={() => router.push(basePath)} />
      );
    }

    // Filters applied but no results
    if (hasFilters) {
      return (
        <EmptyFilters
          onClear={onClearFilters || (() => router.push(basePath))}
        />
      );
    }

    // Truly empty - no tickets at all
    return <EmptyTickets onCreate={() => router.push(`${basePath}/new`)} />;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "NEW":
        return "border-blue-200 bg-blue-50 text-blue-700";
      case "OPEN":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
      case "IN_PROGRESS":
        return "border-amber-200 bg-amber-50 text-amber-700";
      case "WAITING_ON_CUSTOMER":
        return "border-purple-200 bg-purple-50 text-purple-700";
      case "RESOLVED":
        return "border-slate-200 bg-slate-50 text-slate-700";
      case "CLOSED":
        return "border-slate-300 bg-slate-100 text-slate-700";
      default:
        return "border-slate-200 bg-slate-50 text-slate-700";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "P1":
        return "border-red-200 bg-red-50 text-red-700";
      case "P2":
        return "border-orange-200 bg-orange-50 text-orange-700";
      case "P3":
        return "border-amber-200 bg-amber-50 text-amber-700";
      case "P4":
        return "border-slate-200 bg-slate-50 text-slate-700";
      default:
        return "border-slate-200 bg-slate-50 text-slate-700";
    }
  };

  return (
    <div className="space-y-3">
      {selectedTicketIds.size > 0 && internalUsers && (
        <BulkActions
          selectedTicketIds={Array.from(selectedTicketIds)}
          onClearSelection={() => setSelectedTicketIds(new Set())}
          internalUsers={internalUsers}
        />
      )}

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        {tickets.length > 0 && internalUsers && (
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <input
              type="checkbox"
              checked={selectedTicketIds.size === tickets.length}
              onChange={toggleSelectAll}
              className="rounded border-gray-300"
            />
            <span className="text-xs font-medium text-slate-600">
              Select all ({selectedTicketIds.size} selected)
            </span>
          </div>
        )}

        {tickets.map((ticket) => (
          <div
            key={ticket.id}
            className={`flex items-start gap-3 border-b border-slate-100 p-3 transition-colors last:border-b-0 ${
              selectedTicketIds.has(ticket.id)
                ? "bg-blue-50"
                : "hover:bg-slate-50"
            }`}
          >
            {internalUsers && (
              <input
                type="checkbox"
                checked={selectedTicketIds.has(ticket.id)}
                onChange={() => toggleSelection(ticket.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 rounded border-gray-300"
              />
            )}
            <Link
              href={`${basePath}/${ticket.id}`}
              className="grid min-w-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_180px_140px]"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-900">
                    {ticket.key}
                  </span>
                  <Badge variant="outline" className={getStatusColor(ticket.status)}>
                    {ticket.status.replaceAll("_", " ")}
                  </Badge>
                  <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
                    {ticket.priority}
                  </Badge>
                  {ticket.tagAssignments?.map((assignment) => (
                    <Badge
                      key={assignment.tag.id}
                      variant="outline"
                      className="text-xs"
                      style={{
                        backgroundColor: assignment.tag.color
                          ? `${assignment.tag.color}20`
                          : undefined,
                        color: assignment.tag.color || undefined,
                      }}
                    >
                      {assignment.tag.name}
                    </Badge>
                  ))}
                </div>
                <h3 className="truncate text-sm font-semibold text-slate-950">
                  {searchTerm ? (
                    <SearchHighlight text={ticket.subject} searchTerm={searchTerm} />
                  ) : (
                    ticket.subject
                  )}
                </h3>
                <p className="line-clamp-1 text-xs text-slate-500">
                  {searchTerm ? (
                    <SearchHighlight text={ticket.description} searchTerm={searchTerm} />
                  ) : (
                    ticket.description
                  )}
                </p>
              </div>
              <div className="min-w-0 text-xs text-slate-500">
                <div className="truncate font-medium text-slate-700">
                  {ticket.organization?.name || "Public intake"}
                </div>
                <div className="truncate">
                  {ticket.requester?.name ||
                    ticket.requester?.email ||
                    ticket.requesterEmail ||
                    "Unknown requester"}
                </div>
                <div className="truncate">
                  {ticket.assignee
                    ? ticket.assignee.name || ticket.assignee.email
                    : "Unassigned"}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 xl:justify-end">
                <Clock3 className="h-3.5 w-3.5" />
                {formatDate(ticket.updatedAt || ticket.createdAt)}
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
