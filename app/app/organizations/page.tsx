import { requireInternalRole } from "@/lib/auth/permissions";
import { db } from "@/db";
import {
  assets,
  kbArticles,
  memberships,
  organizations,
  tickets,
  zabbixConfigs,
} from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { asc, eq, inArray, sql } from "drizzle-orm";
import {
  ArrowRight,
  Building2,
  Globe2,
  LifeBuoy,
  MonitorDot,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";

interface OrganizationsPageProps {
  searchParams: Promise<{ showDisabled?: string }>;
}

export default async function OrganizationsPage({
  searchParams,
}: OrganizationsPageProps) {
  await requireInternalRole();

  const params = await searchParams;
  const showDisabled = params.showDisabled === "true";

  const [orgList, allOrgs, disabledCount] = await Promise.all([
    db.query.organizations.findMany({
      where: showDisabled ? undefined : eq(organizations.isActive, true),
      orderBy: (orgs, { asc }) => [asc(orgs.name)],
    }),
    db.query.organizations.findMany({
      columns: {
        id: true,
        customerId: true,
        allowPublicIntake: true,
        isActive: true,
      },
    }),
    db.$count(organizations, eq(organizations.isActive, false)),
  ]);

  const orgIds = orgList.map((org) => org.id);
  const [ticketCounts, memberCounts, assetCounts, articleCounts, zabbixRows] =
    orgIds.length > 0
      ? await Promise.all([
          db
            .select({
              orgId: tickets.orgId,
              count: sql<number>`count(*)::int`,
            })
            .from(tickets)
            .where(inArray(tickets.orgId, orgIds))
            .groupBy(tickets.orgId),
          db
            .select({
              orgId: memberships.orgId,
              count: sql<number>`count(*)::int`,
            })
            .from(memberships)
            .where(inArray(memberships.orgId, orgIds))
            .groupBy(memberships.orgId),
          db
            .select({
              orgId: assets.orgId,
              count: sql<number>`count(*)::int`,
            })
            .from(assets)
            .where(inArray(assets.orgId, orgIds))
            .groupBy(assets.orgId),
          db
            .select({
              orgId: kbArticles.orgId,
              count: sql<number>`count(*)::int`,
            })
            .from(kbArticles)
            .where(inArray(kbArticles.orgId, orgIds))
            .groupBy(kbArticles.orgId),
          db
            .select({ orgId: zabbixConfigs.orgId })
            .from(zabbixConfigs)
            .where(inArray(zabbixConfigs.orgId, orgIds))
            .orderBy(asc(zabbixConfigs.orgId)),
        ])
      : [[], [], [], [], []];

  const makeCountMap = (
    rows: { orgId: string | null; count: number }[],
  ): Map<string, number> =>
    new Map(
      rows
        .filter((row): row is { orgId: string; count: number } => Boolean(row.orgId))
        .map((row) => [row.orgId, Number(row.count)]),
    );

  const ticketCountMap = makeCountMap(ticketCounts);
  const memberCountMap = makeCountMap(memberCounts);
  const assetCountMap = makeCountMap(assetCounts);
  const articleCountMap = makeCountMap(articleCounts);
  const zabbixOrgIds = new Set(zabbixRows.map((row) => row.orgId));

  const activeCount = allOrgs.filter((org) => org.isActive).length;
  const publicIntakeCount = allOrgs.filter((org) => org.allowPublicIntake).length;
  const missingCustomerIdCount = allOrgs.filter((org) => !org.customerId).length;

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
              <Building2 className="h-4 w-4" />
              Customer Directory
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Control customer identities, portal access, intake posture, users, assets, and ITSM configuration from one directory.
            </p>
          </div>
          <Button asChild>
            <Link href="/app/organizations/new">New Organization</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DirectoryStat icon={ShieldCheck} label="Active tenants" value={activeCount} detail={`${disabledCount} disabled`} />
        <DirectoryStat icon={LifeBuoy} label="Public intake enabled" value={publicIntakeCount} detail="Customer-created tickets" />
        <DirectoryStat icon={Globe2} label="Customer IDs missing" value={missingCustomerIdCount} detail="Required for ticket naming" />
        <DirectoryStat icon={MonitorDot} label="Zabbix configured" value={zabbixOrgIds.size} detail="Monitoring integrations" />
      </section>

      {disabledCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-600">
            {disabledCount} disabled organization{disabledCount !== 1 ? "s" : ""}
          </span>
          <Link
            href={
              showDisabled
                ? "/app/organizations"
                : "/app/organizations?showDisabled=true"
            }
            className="font-medium text-slate-950 hover:underline"
          >
            {showDisabled ? "Hide disabled" : "Show disabled"}
          </Link>
        </div>
      )}

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-950">
          <div>
            <h2 className="text-sm font-semibold">Customer control plane</h2>
            <p className="text-xs text-slate-500">
              {orgList.length} organization{orgList.length !== 1 ? "s" : ""} shown
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900">
            <Search className="h-4 w-4" />
            Use browser search for now
          </div>
        </div>
        {orgList.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            {showDisabled
              ? "No organizations found."
              : "No active organizations. Create one or check disabled organizations."}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {orgList.map((org) => (
              <Link
                key={org.id}
                href={`/app/organizations/${org.id}`}
                className={`grid gap-4 px-4 py-4 transition-colors hover:bg-slate-50 lg:grid-cols-[minmax(0,1fr)_520px_24px] dark:hover:bg-slate-950 ${
                  !org.isActive ? "bg-slate-50/70 opacity-70 dark:bg-slate-950" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold text-slate-950 dark:text-white">
                      {org.name}
                    </h3>
                    <Badge variant="outline" className="font-mono">
                      {org.customerId || "NO-ID"}
                    </Badge>
                    {!org.isActive && (
                      <Badge variant="destructive" className="text-xs">
                        Disabled
                      </Badge>
                    )}
                    {org.allowPublicIntake ? (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        Public intake
                      </Badge>
                    ) : (
                      <Badge variant="outline">Private intake</Badge>
                    )}
                  </div>
                  <p className="truncate text-sm text-slate-500">
                    {org.subdomain}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000"}
                  </p>
                  {!org.isActive && org.disabledAt && (
                    <p className="mt-1 text-xs text-slate-500">
                      Disabled on {new Date(org.disabledAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                  <DirectoryMetric label="Tickets" value={ticketCountMap.get(org.id) ?? 0} />
                  <DirectoryMetric label="Users" value={memberCountMap.get(org.id) ?? 0} />
                  <DirectoryMetric label="Assets" value={assetCountMap.get(org.id) ?? 0} />
                  <DirectoryMetric label="KB" value={articleCountMap.get(org.id) ?? 0} />
                  <DirectoryMetric label="Zabbix" value={zabbixOrgIds.has(org.id) ? "On" : "Off"} />
                </div>
                <ArrowRight className="hidden h-5 w-5 self-center text-slate-300 lg:block" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DirectoryStat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="rounded-md border border-slate-200 p-2 text-slate-500 dark:border-slate-800">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function DirectoryMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="font-semibold text-slate-950 dark:text-white">{value}</div>
      <div className="mt-0.5 flex items-center gap-1 text-slate-500">
        {label === "Users" && <Users className="h-3 w-3" />}
        {label}
      </div>
    </div>
  );
}
