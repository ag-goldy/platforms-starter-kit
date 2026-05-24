"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  SlidersHorizontal,
  X,
  Globe2,
  Inbox,
  UserX,
  Clock,
  AlertCircle,
} from "lucide-react";

interface TicketToolbarProps {
  currentUserId: string;
  activeFilterCount: number;
  children: React.ReactNode;
}

const views = [
  { name: "All", href: "/app/tickets", icon: null },
  { name: "Public", href: "/app/tickets?orgId=public", icon: Globe2 },
  { name: "My Open", href: (id: string) => `/app/tickets?status=OPEN&assigneeId=${id}`, icon: Inbox },
  { name: "Unassigned", href: "/app/tickets?status=OPEN&assigneeId=unassigned", icon: UserX },
  { name: "Waiting", href: "/app/tickets?status=WAITING_ON_CUSTOMER", icon: Clock },
  { name: "P1/P2", href: "/app/tickets?priority=P1", icon: AlertCircle },
];

export function TicketToolbar({
  currentUserId,
  activeFilterCount,
  children,
}: TicketToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [showFilters, setShowFilters] = useState(activeFilterCount > 0);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search.trim()) {
      params.set("search", search.trim());
    } else {
      params.delete("search");
    }
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  function isViewActive(view: (typeof views)[0]) {
    const href = typeof view.href === "function" ? view.href(currentUserId) : view.href;
    const viewParams = new URLSearchParams(href.split("?")[1] || "");
    const current = new URLSearchParams(searchParams.toString());

    // "All" is active when no filters
    if (view.name === "All") {
      return !search && current.toString() === "";
    }

    for (const [key, value] of viewParams) {
      if (current.get(key) !== value) return false;
    }
    return true;
  }

  return (
    <div className="space-y-3">
      {/* Search + filters toggle */}
      <div className="flex gap-2">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets..."
            className="pl-9"
          />
        </form>
        <Button
          variant={showFilters ? "default" : "outline"}
          size="icon"
          onClick={() => setShowFilters((s) => !s)}
          title="Toggle filters"
          className="shrink-0"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick view chips */}
      <div className="flex flex-wrap gap-1.5">
        {views.map((view) => {
          const Icon = view.icon;
          const href = typeof view.href === "function" ? view.href(currentUserId) : view.href;
          const active = isViewActive(view);
          return (
            <button
              key={view.name}
              onClick={() => router.push(href)}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
              ].join(" ")}
            >
              {Icon && <Icon className="h-3 w-3" />}
              {view.name}
            </button>
          );
        })}
        {activeFilterCount > 0 && (
          <button
            onClick={() => router.push("/app/tickets")}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <X className="h-3 w-3" />
            Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Collapsible filters */}
      {showFilters && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {children}
        </div>
      )}
    </div>
  );
}
