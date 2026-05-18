"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  ClipboardList,
  Database,
  FileClock,
  Flag,
  Gauge,
  HeartPulse,
  Home,
  Layers3,
  ListChecks,
  LockKeyhole,
  MessageSquarePlus,
  Network,
  PanelLeft,
  Shield,
  ShieldCheck,
  Siren,
  Tags,
  Ticket,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type {
  AdminNavSection,
  CustomerNavItem,
  EnterpriseIconName,
} from "@/lib/navigation/enterprise";

const icons: Record<EnterpriseIconName, LucideIcon> = {
  activity: Activity,
  analytics: BarChart3,
  book: BookOpen,
  bot: Bot,
  building: Building2,
  clipboard: ClipboardList,
  database: Database,
  fileClock: FileClock,
  flag: Flag,
  gauge: Gauge,
  heartPulse: HeartPulse,
  home: Home,
  layers: Layers3,
  listChecks: ListChecks,
  lock: LockKeyhole,
  messagePlus: MessageSquarePlus,
  network: Network,
  panel: PanelLeft,
  shield: Shield,
  shieldCheck: ShieldCheck,
  siren: Siren,
  tags: Tags,
  ticket: Ticket,
  users: Users,
  workflow: Workflow,
};

function isActive(pathname: string, href: string, exact?: boolean) {
  const [path] = href.split("?");
  if (exact) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function EnterpriseAdminSidebar({
  sections,
  compact = false,
}: {
  sections: AdminNavSection[];
  compact?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-6">
      {sections.map((section) => (
        <section key={section.label} className="space-y-2">
          {!compact && (
            <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {section.label}
            </div>
          )}
          <div className="space-y-1">
            {section.items.map((item) => {
              const Icon = icons[item.icon];
              const active = isActive(pathname, item.href, item.exact);
              return (
                <Link
                  key={`${section.label}-${item.href}-${item.label}`}
                  href={item.href}
                  title={compact ? item.label : undefined}
                  className={[
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
                    compact ? "justify-center" : "",
                  ].join(" ")}
                >
                  <Icon
                    className={[
                      "h-4 w-4 shrink-0",
                      active
                        ? "text-orange-400 dark:text-orange-600"
                        : "text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200",
                    ].join(" ")}
                  />
                  {!compact && (
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {item.label}
                      </span>
                      {item.description && (
                        <span className="block truncate text-[11px] leading-4 opacity-70">
                          {item.description}
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

export function CustomerPortalNav({
  items,
  mobile = false,
}: {
  items: CustomerNavItem[];
  mobile?: boolean;
}) {
  const pathname = usePathname();

  if (mobile) {
    return (
      <nav className="grid grid-cols-4 gap-1 px-2 py-2">
        {items.slice(0, 4).map((item) => {
          const Icon = icons[item.icon];
          const active = isActive(pathname, item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex flex-col items-center gap-1 rounded-md px-2 py-1.5 text-xs",
                active ? "bg-slate-950 text-white" : "text-slate-600",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const Icon = icons[item.icon];
        const active = isActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              item.primary && !active
                ? "border border-orange-200 bg-orange-50 text-slate-950 hover:bg-orange-100"
                : active
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
            ].join(" ")}
          >
            <Icon
              className={
                active
                  ? "h-4 w-4 text-orange-400"
                  : "h-4 w-4 text-slate-400 group-hover:text-slate-700"
              }
            />
            <span className="min-w-0">
              <span className="block truncate font-medium">{item.label}</span>
              {item.description && (
                <span className="block truncate text-[11px] leading-4 opacity-70">
                  {item.description}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
