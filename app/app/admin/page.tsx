import Link from "next/link";
import {
  Activity,
  Bot,
  ClipboardList,
  Database,
  HeartPulse,
  History,
  Network,
  Plug,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { db } from "@/db";
import {
  aiAuditLog,
  auditLogs,
  emailOutbox,
  organizations,
  tickets,
  zabbixConfigs,
} from "@/db/schema";
import { requireInternalAdmin } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { eq, sql } from "drizzle-orm";

export default async function AdminGovernancePage() {
  await requireInternalAdmin();

  const [
    orgStats,
    ticketStats,
    auditStats,
    failedEmailCount,
    zabbixCount,
    aiAuditCount,
  ] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${organizations.isActive} = true)::int`,
      })
      .from(organizations),
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${tickets.status} not in ('CLOSED', 'MERGED'))::int`,
      })
      .from(tickets),
    db
      .select({
        total: sql<number>`count(*)::int`,
        recent: sql<number>`count(*) filter (where ${auditLogs.createdAt} >= now() - interval '7 days')::int`,
      })
      .from(auditLogs),
    db.$count(emailOutbox, eq(emailOutbox.status, "FAILED")),
    db.$count(zabbixConfigs),
    db.$count(aiAuditLog),
  ]);

  const orgSummary = orgStats[0] ?? { total: 0, active: 0 };
  const ticketSummary = ticketStats[0] ?? { total: 0, active: 0 };
  const auditSummary = auditStats[0] ?? { total: 0, recent: 0 };

  const governanceCards = [
    {
      href: "/app/admin/audit",
      title: "Audit Logs",
      description: "Immutable actor, organization, action, and timestamp trail.",
      icon: History,
      signal: `${auditSummary.recent} recent`,
    },
    {
      href: "/app/admin/health",
      title: "System Health",
      description: "Database, Blob, Redis, SMTP, email failures, and queue status.",
      icon: HeartPulse,
      signal: failedEmailCount > 0 ? `${failedEmailCount} failed emails` : "No failed emails",
    },
    {
      href: "/app/admin/jobs",
      title: "Job Queue",
      description: "Background task failures, retries, and operational recovery.",
      icon: ClipboardList,
      signal: "Queue controls",
    },
    {
      href: "/app/admin/compliance",
      title: "Compliance",
      description: "Exports, anonymization, and tenant data request workflows.",
      icon: Scale,
      signal: `${orgSummary.total} tenants`,
    },
    {
      href: "/app/admin/retention",
      title: "Retention",
      description: "Tenant data retention and anonymization policy controls.",
      icon: Database,
      signal: "Policy managed",
    },
    {
      href: "/app/admin/ai-audit",
      title: "AI Audit",
      description: "Review AI usage, risk events, and assistant access patterns.",
      icon: Bot,
      signal: `${aiAuditCount} events`,
    },
    {
      href: "/app/admin/integrations",
      title: "Integrations",
      description: "External services, storage, communications, and security providers.",
      icon: Plug,
      signal: "Registry",
    },
    {
      href: "/app/admin/zabbix",
      title: "Zabbix",
      description: "Monitoring configuration and infrastructure sync posture.",
      icon: Network,
      signal: `${zabbixCount} configured`,
    },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
              <ShieldCheck className="h-4 w-4" />
              Platform Governance
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Operations command surface
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Centralized transparency for security, health, jobs, compliance, AI, integrations, and tenant controls.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/app/admin/health">Health</Link>
            </Button>
            <Button asChild>
              <Link href="/app/admin/audit">Audit trail</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <HubMetric label="Tenants" value={orgSummary.active} detail={`${orgSummary.total} total`} />
        <HubMetric label="Active tickets" value={ticketSummary.active} detail={`${ticketSummary.total} total`} />
        <HubMetric label="Audit events" value={auditSummary.total} detail={`${auditSummary.recent} in 7 days`} />
        <HubMetric label="Zabbix configs" value={zabbixCount} detail="Monitoring tenants" />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        {governanceCards.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex min-h-[128px] items-start justify-between gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-950"
          >
            <div className="flex min-w-0 gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 dark:border-slate-800">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-950 dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {item.description}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0">
              {item.signal}
            </Badge>
          </Link>
        ))}
      </section>
    </div>
  );
}

function HubMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Activity className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}
