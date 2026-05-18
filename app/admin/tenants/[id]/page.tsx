import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  memberships,
  organizations,
  tickets,
  users,
} from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/admin/platform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  enableTenantAction,
  scheduleTenantDeleteAction,
  startImpersonationAction,
  suspendTenantAction,
  updateTenantFeatureFlagsAction,
} from "../../actions";

function FeatureToggle({
  name,
  label,
  enabled,
}: {
  name: string;
  label: string;
  enabled: boolean;
}) {
  return (
    <label className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
      <span>{label}</span>
      <input
        name={name}
        type="checkbox"
        defaultChecked={enabled}
        className="h-4 w-4 accent-orange-500"
      />
    </label>
  );
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;

  /* eslint-disable no-restricted-syntax -- Platform admin tenant lookup is intentionally cross-tenant and keyed by tenant id. */
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, id),
  });
  /* eslint-enable no-restricted-syntax */
  if (!org) notFound();

  const [members, ticketCount, recentAudit] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: memberships.role,
        isActive: memberships.isActive,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.orgId, org.id))
      .limit(100),
    db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(eq(tickets.orgId, org.id)),
    db.query.auditLogs.findMany({
      where: eq(auditLogs.orgId, org.id),
      orderBy: [desc(auditLogs.createdAt)],
      limit: 10,
    }),
  ]);

  const features = (org.features || {}) as Record<string, boolean | undefined>;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className="text-sm text-zinc-500 hover:text-zinc-200"
        >
          Back to tenants
        </Link>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">{org.name}</h1>
            <p className="text-sm text-zinc-400">
              {org.slug} · {org.subdomain}
            </p>
          </div>
          <div className="flex gap-2">
            {!org.isActive ? (
              <Badge variant="secondary">Suspended</Badge>
            ) : (
              <Badge>Active</Badge>
            )}
            {org.deletionScheduledAt && (
              <Badge variant="outline">Delete scheduled</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-400">Tickets</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {Number(ticketCount[0]?.count || 0)}
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-400">Members</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {members.length}
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-400">Storage</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {Math.round((org.storageUsedBytes || 0) / 1024 / 1024)} MB
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
          <CardHeader>
            <CardTitle>Tenant Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <form action={suspendTenantAction} className="space-y-2">
                <input type="hidden" name="orgId" value={org.id} />
                <input
                  name="reason"
                  placeholder="Suspension reason"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
                <Button
                  type="submit"
                  disabled={!org.isActive}
                  className="w-full bg-rose-600 hover:bg-rose-500"
                >
                  Suspend
                </Button>
              </form>
              <form action={enableTenantAction}>
                <input type="hidden" name="orgId" value={org.id} />
                <Button
                  type="submit"
                  disabled={org.isActive}
                  variant="outline"
                  className="w-full border-zinc-700 bg-zinc-950 text-zinc-100"
                >
                  Enable
                </Button>
              </form>
              <form action={scheduleTenantDeleteAction}>
                <input type="hidden" name="orgId" value={org.id} />
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full border-rose-900 bg-rose-950 text-rose-200"
                >
                  Schedule delete
                </Button>
              </form>
            </div>
            {org.deletionScheduledAt && (
              <p className="text-sm text-amber-300">
                Tenant deletion is scheduled for{" "}
                {org.deletionScheduledAt.toLocaleString()}.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
          <CardHeader>
            <CardTitle>Impersonation</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={startImpersonationAction} className="space-y-3">
              <input type="hidden" name="orgId" value={org.id} />
              <select
                name="userId"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              >
                {members
                  .filter((member) => member.isActive)
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name || member.email} · {member.role}
                    </option>
                  ))}
              </select>
              <input
                name="reason"
                placeholder="Reason for impersonation"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                required
              />
              <select
                name="durationMinutes"
                defaultValue="30"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">60 minutes</option>
              </select>
              <Button
                type="submit"
                className="bg-orange-500 text-zinc-950 hover:bg-orange-400"
              >
                Start impersonation
              </Button>
              <p className="text-xs text-zinc-500">
                Starts an audited impersonation session and shows a banner until
                exited.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateTenantFeatureFlagsAction} className="space-y-4">
            <input type="hidden" name="orgId" value={org.id} />
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <FeatureToggle
                name="assets"
                label="Assets"
                enabled={features.assets ?? true}
              />
              <FeatureToggle
                name="exports"
                label="Exports"
                enabled={features.exports ?? true}
              />
              <FeatureToggle
                name="team"
                label="Team"
                enabled={features.team ?? true}
              />
              <FeatureToggle
                name="services"
                label="Services"
                enabled={features.services ?? true}
              />
              <FeatureToggle
                name="knowledge"
                label="Knowledge"
                enabled={features.knowledge ?? true}
              />
              <FeatureToggle
                name="status_page"
                label="Status Page"
                enabled={features.status_page ?? false}
              />
              <FeatureToggle
                name="service_catalog"
                label="Service Catalog"
                enabled={features.service_catalog ?? false}
              />
            </div>
            <Button
              type="submit"
              className="bg-orange-500 text-zinc-950 hover:bg-orange-400"
            >
              Save feature flags
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
        <CardHeader>
          <CardTitle>Recent Tenant Audit</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="py-2">Action</th>
                <th>Actor</th>
                <th>Details</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {recentAudit.map((log) => (
                <tr key={log.id}>
                  <td className="py-3">{log.action}</td>
                  <td className="text-zinc-400">
                    {log.platformAdminId || log.userId || "system"}
                  </td>
                  <td className="max-w-md truncate text-zinc-500">
                    {log.details}
                  </td>
                  <td className="text-zinc-500">
                    {log.createdAt.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
