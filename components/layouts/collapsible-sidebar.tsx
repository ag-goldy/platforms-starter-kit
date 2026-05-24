"use client";

import { useState, useEffect, useCallback } from "react";
import { PanelLeft, PanelRight } from "lucide-react";
import { EnterpriseAdminSidebar } from "./enterprise-sidebar";
import type { AdminNavSection } from "@/lib/navigation/enterprise";

interface CollapsibleSidebarProps {
  sections: AdminNavSection[];
  logo: React.ReactNode;
}

const STORAGE_KEY = "atlas-sidebar-collapsed";

export function CollapsibleSidebar({ sections, logo }: CollapsibleSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
    setMounted(true);

    // Auto-collapse on smaller viewports
    const mq = window.matchMedia("(max-width: 1280px)");
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        setCollapsed(true);
      }
    };
    handleChange(mq);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  // Prevent layout shift during SSR/hydration
  if (!mounted) {
    return (
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-900 lg:block">
        {logo}
        <EnterpriseAdminSidebar sections={sections} />
      </aside>
    );
  }

  return (
    <aside
      className={[
        "hidden shrink-0 border-r border-slate-200 bg-white py-5 transition-[width] duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-900 lg:block",
        collapsed ? "w-16 px-2" : "w-64 px-3",
      ].join(" ")}
    >
      <div className={["mb-6 flex items-center", collapsed ? "justify-center px-0" : "gap-2 px-1"].join(" ")}>
        {/* Logo always visible */}
        <div className={collapsed ? "flex justify-center w-full" : "min-w-0 flex-1"}>
          {collapsed ? (
            <div className="flex items-center justify-center">
              <img
                src="/logo/atlas-logo.png"
                alt="Atlas"
                className="h-7 w-auto"
              />
            </div>
          ) : (
            logo
          )}
        </div>
        <button
          onClick={toggle}
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          {collapsed ? <PanelRight className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </button>
      </div>
      <EnterpriseAdminSidebar sections={sections} compact={collapsed} />
    </aside>
  );
}
