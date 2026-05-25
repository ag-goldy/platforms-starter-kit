import { requireInternalRole } from "@/lib/auth/permissions";
import { db } from "@/db";
import {
  assets,
  auditLogs,
  kbArticles,
  organizations,
  requestTypes,
  tickets,
  zabbixConfigs,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { OrganizationTeamManager } from "@/components/organizations/organization-team-manager";
import { Organization2FAPolicy } from "@/components/organizations/organization-2fa-policy";
import { OrganizationSLAPolicy } from "@/components/organizations/organization-sla-policy";
import { OrgDangerZone } from "@/components/organizations/org-danger-zone";
import { getPendingInvitations } from "@/lib/users/invitations";
import { getOrganizationMembersAction } from "@/app/app/actions/users";
import { updateOrganizationCustomerIdAction } from "@/app/app/actions/organizations";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Bot,
  Building2,
  Database,
  Gauge,
  GitBranch,
  Globe2,
  HardDrive,
  History,
  KeyRound,
  LifeBuoy,
  LockKeyhole,
  Mail,
  MonitorDot,
  Network,
  PanelTop,
  Plug,
  Settings,
  Workflow,
  FileText,
  Layers,
  MapPin,
  Server,
  Bell,
  Users,
  Sparkles,
} from "lucide-react";

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireInternalRole();
  const resolvedParams = await params;
  const orgId = resolvedParams.id;

  const orgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  const org = orgs[0];

  if (!org) {
    notFound();
  }

  async function updateCustomerId(formData: FormData) {
    "use server";
    const customerId = String(formData.get("customerId") || "");
    await updateOrganizationCustomerIdAction(orgId, customerId);
  }

  const [
    members,
    invitations,
    ticketStats,
    assetStats,
    kbStats,
    requestTypeCount,
    zabbixConfig,
    auditStats,
  ] = await Promise.all([
    getOrganizationMembersAction(orgId),
    getPendingInvitations(orgId),
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${tickets.status} not in ('CLOSED', 'MERGED'))::int`,
        waiting: sql<number>`count(*) filter (where ${tickets.status} = 'WAITING_ON_CUSTOMER')::int`,
        publicIntake: sql<number>`count(*) filter (where ${tickets.requesterId} is null)::int`,
      })
      .from(tickets)
      .where(eq(tickets.orgId, orgId)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        monitored: sql<number>`count(*) filter (where ${assets.monitoringEnabled} = true)::int`,
      })
      .from(assets)
      .where(eq(assets.orgId, orgId)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${kbArticles.status} = 'published')::int`,
      })
      .from(kbArticles)
      .where(eq(kbArticles.orgId, orgId)),
    db.$count(requestTypes, eq(requestTypes.orgId, orgId)),
    db.query.zabbixConfigs.findFirst({
      where: eq(zabbixConfigs.orgId, orgId),
    }),
    db
      .select({
        total: sql<number>`count(*)::int`,
        recent: sql<number>`count(*) filter (where ${auditLogs.createdAt} >= now() - interval '7 days')::int`,
      })
      .from(auditLogs)
      .where(eq(auditLogs.orgId, orgId)),
  ]);

  const ticketSummary = ticketStats[0] ?? {
    total: 0,
    active: 0,
    waiting: 0,
    publicIntake: 0,
  };
  const assetSummary = assetStats[0] ?? { total: 0, monitored: 0 };
  const kbSummary = kbStats[0] ?? { total: 0, published: 0 };
  const auditSummary = auditStats[0] ?? { total: 0, recent: 0 };
  const features = org.features ?? {};
  const storageUsed = Number(org.storageUsedBytes ?? 0);
  const storageQuota = Number(org.storageQuotaBytes ?? 0);

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link
          href="/app/organizations"
          className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to organizations
        </Link>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {org.customerId || "NO-ID"}
              </Badge>
              {org.isActive ? (
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  Active
                </Badge>
              ) : (
                <Badge variant="destructive">Disabled</Badge>
              )}
              {org.allowPublicIntake ? (
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                  Public intake enabled
                </Badge>
              ) : (
                <Badge variant="outline">Private intake</Badge>
              )}
              {zabbixConfig ? (
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  Zabbix connected
                </Badge>
              ) : (
                <Badge variant="outline">No Zabbix config</Badge>
              )}
            </div>
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {org.name}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {org.subdomain}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000"}
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3 xl:min-w-[560px]">
            <ControlMetric icon={LifeBuoy} label="Active tickets" value={ticketSummary.active} detail={`${ticketSummary.total} total`} />
            <ControlMetric icon={Users} label="Customer users" value={members.length} detail={`${invitations.length} pending invites`} />
            <ControlMetric icon={HardDrive} label="Assets" value={assetSummary.total} detail={`${assetSummary.monitored} monitored`} />
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ControlMetric icon={FileText} label="Published KB" value={kbSummary.published} detail={`${kbSummary.total} articles`} />
        <ControlMetric icon={PanelTop} label="Request types" value={requestTypeCount} detail="Service catalog forms" />
        <ControlMetric icon={History} label="Audit events" value={auditSummary.total} detail={`${auditSummary.recent} in 7 days`} />
        <ControlMetric icon={Database} label="Storage used" value={formatBytes(storageUsed)} detail={`${formatBytes(storageQuota)} quota`} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            Identity and naming
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <form
            action={updateCustomerId}
            className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="customerId">Customer ID</Label>
              <Input
                id="customerId"
                name="customerId"
                defaultValue={org.customerId || ""}
                placeholder="ACME"
                pattern="[A-Za-z0-9]+"
              />
              <p className="text-xs text-gray-500">
                Used for new ticket IDs, for example AGRN-925180.
              </p>
            </div>
            <Button type="submit">Save</Button>
          </form>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="font-medium text-slate-950 dark:text-white">Portal routing</div>
            <p className="mt-1 text-slate-500">
              Canonical customer portal:{" "}
              <Link className="font-medium text-slate-950 hover:underline dark:text-white" href={`/s/${org.subdomain}`}>
                /s/{org.subdomain}
              </Link>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Customer ID powers customer-specific ticket keys and should match your internal customer registry.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Administration surfaces
          </CardTitle>
        </CardHeader>
        <CardContent>
          <nav className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <AdminSurface href={`/app/organizations/${orgId}/automation`} icon={Workflow} title="Automation Rules" description="Routing, escalation, and lifecycle automation" />
            <AdminSurface href={`/app/organizations/${orgId}/request-types`} icon={FileText} title="Service Catalog" description={`${requestTypeCount} request type${requestTypeCount !== 1 ? "s" : ""} and dynamic forms`} />
            <AdminSurface href={`/app/organizations/${orgId}/services`} icon={Layers} title="Services" description="Services, ownership, and SLA policies" />
            <AdminSurface href={`/app/organizations/${orgId}/sites`} icon={MapPin} title="Sites & Areas" description="Locations, floors, areas, and routing context" />
            <AdminSurface href={`/app/organizations/${orgId}/assets`} icon={Server} title="Assets" description={`${assetSummary.total} assets, ${assetSummary.monitored} monitored`} />
            <AdminSurface href={`/app/organizations/${orgId}/notices`} icon={Bell} title="Notices" description="Maintenance banners and customer portal notices" />
            <AdminSurface href={`/app/organizations/${orgId}/email-settings`} icon={Mail} title="Email-to-Ticket" description={org.intakeEmailAddress || "Configure intake and auto-replies"} />
            <AdminSurface href={`/app/organizations/${orgId}/ai-settings`} icon={Sparkles} title="AI Settings" description="Data access, suggestions, and assistant controls" />
            <AdminSurface href={`/app/admin/audit?orgId=${orgId}`} icon={History} title="Audit Trail" description={`${auditSummary.total} immutable events`} />
          </nav>
          <div className="mt-4 pt-4 border-t">
            <Organization2FAPolicy
              orgId={orgId}
              requireTwoFactor={org.requireTwoFactor || false}
            />
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe2 className="h-4 w-4" />
                Portal, intake, and features
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <FeatureLine icon={LifeBuoy} label="Public intake" value={org.allowPublicIntake ? "Enabled" : "Disabled"} />
              <FeatureLine icon={Mail} label="Intake email" value={org.intakeEmailAddress || "Not configured"} />
              <FeatureLine icon={Users} label="Team monitoring" value={features.team !== false ? "Available" : "Disabled"} />
              <FeatureLine icon={FileText} label="Knowledge" value={features.knowledge !== false ? "Available" : "Disabled"} />
              <FeatureLine icon={PanelTop} label="Service catalog" value={features.service_catalog !== false && features.services !== false ? "Available" : "Disabled"} />
              <FeatureLine icon={MonitorDot} label="Status page" value={features.status_page !== false ? "Available" : "Disabled"} />
            </CardContent>
          </Card>

          <OrganizationSLAPolicy
            orgId={orgId}
            currentPolicy={{
              slaResponseHoursP1: org.slaResponseHoursP1,
              slaResponseHoursP2: org.slaResponseHoursP2,
              slaResponseHoursP3: org.slaResponseHoursP3,
              slaResponseHoursP4: org.slaResponseHoursP4,
              slaResolutionHoursP1: org.slaResolutionHoursP1,
              slaResolutionHoursP2: org.slaResolutionHoursP2,
              slaResolutionHoursP3: org.slaResolutionHoursP3,
              slaResolutionHoursP4: org.slaResolutionHoursP4,
            }}
          />
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Network className="h-4 w-4" />
                Integration posture
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <FeatureLine icon={MonitorDot} label="Zabbix" value={zabbixConfig ? "Connected" : "Not configured"} />
              <FeatureLine icon={Mail} label="Email domain" value={org.emailDomain || "Not configured"} />
              <FeatureLine icon={GitBranch} label="Public tickets" value={`${ticketSummary.publicIntake} created without a user`} />
              <Button asChild variant="outline" className="w-full">
                <Link href="/app/admin/integrations">
                  <Plug className="mr-2 h-4 w-4" />
                  Manage integrations
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="h-4 w-4" />
                Lifecycle signals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <FeatureLine icon={LifeBuoy} label="Waiting on customer" value={`${ticketSummary.waiting} tickets`} />
              <FeatureLine icon={LockKeyhole} label="Auto-close delay" value={`${org.autoCloseResolvedDays} days`} />
              <FeatureLine icon={Bot} label="Auto-reply" value={org.autoReplyEnabled ? "Enabled" : "Disabled"} />
            </CardContent>
          </Card>
        </aside>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OrganizationTeamManager
            orgId={orgId}
            orgName={org.name}
            members={members}
            invitations={invitations}
          />
        </CardContent>
      </Card>

      <OrgDangerZone
        orgId={orgId}
        orgName={org.name}
        isActive={org.isActive ?? true}
        disabledAt={org.disabledAt}
        disabledBy={org.disabledBy}
      />
    </div>
  );
}

function ControlMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Building2;
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function AdminSurface({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Building2;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[96px] items-start gap-3 rounded-md border border-slate-200 p-4 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950"
    >
      <Icon className="mt-0.5 h-5 w-5 text-slate-500" />
      <div>
        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
          {title}
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </Link>
  );
}

function FeatureLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
      <Icon className="mt-0.5 h-4 w-4 text-slate-500" />
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="mt-1 truncate text-sm font-medium text-slate-950 dark:text-white">
          {value}
        </div>
      </div>
    </div>
  );
}

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
