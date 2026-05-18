import { requireInternalAdmin } from "@/lib/auth/permissions";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

const governanceLinks = [
  { href: "/app/admin/audit", label: "Audit" },
  { href: "/app/admin/health", label: "Health" },
  { href: "/app/admin/ops", label: "Operations" },
  { href: "/app/admin/jobs", label: "Jobs" },
  { href: "/app/admin/compliance", label: "Compliance" },
  { href: "/app/admin/retention", label: "Retention" },
  { href: "/app/admin/integrations", label: "Integrations" },
  { href: "/app/admin/zabbix", label: "Zabbix" },
  { href: "/app/admin/ai-audit", label: "AI Audit" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireInternalAdmin();

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-950 text-orange-400 dark:bg-white dark:text-orange-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Governance and Operations
              </h1>
              <p className="text-sm text-slate-500">
                Guarded administration for security events, system health, jobs,
                compliance, integrations, and platform-facing controls.
              </p>
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto">
            {governanceLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>
      {children}
    </div>
  );
}
