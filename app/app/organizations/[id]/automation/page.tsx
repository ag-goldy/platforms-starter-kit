import { getAutomationRulesAction } from '@/app/app/actions/automation';
import type { ComponentType } from 'react';
import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { automationRuns, organizations } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { AutomationRulesManager } from '@/components/automation/rules-manager';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  CheckCircle2,
  GitBranch,
  ListChecks,
  PlayCircle,
  ShieldAlert,
  Workflow,
  XCircle,
} from 'lucide-react';

export default async function OrganizationAutomationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireInternalRole();
  const resolvedParams = await params;
  const orgId = resolvedParams.id;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) {
    notFound();
  }

  const [rules, runStats, recentRuns] = await Promise.all([
    getAutomationRulesAction(orgId),
    db
      .select({
        total: sql<number>`count(*)::int`,
        matched: sql<number>`count(*) filter (where ${automationRuns.matched} = true)::int`,
        failures: sql<number>`count(*) filter (where ${automationRuns.status} in ('FAILED', 'PARTIAL'))::int`,
        lastDay: sql<number>`count(*) filter (where ${automationRuns.createdAt} >= now() - interval '24 hours')::int`,
      })
      .from(automationRuns)
      .where(eq(automationRuns.orgId, orgId)),
    db
      .select({
        id: automationRuns.id,
        triggerOn: automationRuns.triggerOn,
        matched: automationRuns.matched,
        status: automationRuns.status,
        actionsExecuted: automationRuns.actionsExecuted,
        durationMs: automationRuns.durationMs,
        error: automationRuns.error,
        createdAt: automationRuns.createdAt,
      })
      .from(automationRuns)
      .where(eq(automationRuns.orgId, orgId))
      .orderBy(desc(automationRuns.createdAt))
      .limit(8),
  ]);

  const stats = runStats[0] ?? {
    total: 0,
    matched: 0,
    failures: 0,
    lastDay: 0,
  };
  const activeRules = rules.filter((rule) => rule.enabled).length;
  const rulesWithAI = rules.filter((rule) =>
    rule.actions.some((action) => action.type === 'run_ai'),
  ).length;

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link
          href={`/app/organizations/${orgId}`}
          className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to organization
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {org.subdomain}
              </Badge>
              <Badge variant={activeRules > 0 ? 'default' : 'secondary'}>
                {activeRules} active
              </Badge>
              {stats.failures > 0 ? (
                <Badge variant="destructive">{stats.failures} run issues</Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-700"
                >
                  No run issues
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Automation control
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Configure ticket workflow rules for {org.name}. Rules run in
              priority order and every evaluation is recorded for audit and
              troubleshooting.
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[520px]">
            <AutomationMetric
              icon={Workflow}
              label="Rules"
              value={rules.length}
              detail={`${activeRules} enabled`}
            />
            <AutomationMetric
              icon={PlayCircle}
              label="Runs"
              value={stats.total}
              detail={`${stats.lastDay} in 24h`}
            />
            <AutomationMetric
              icon={GitBranch}
              label="AI actions"
              value={rulesWithAI}
              detail="run_ai executors"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <AutomationMetric
          icon={CheckCircle2}
          label="Matched runs"
          value={stats.matched}
          detail="Rules that met conditions"
        />
        <AutomationMetric
          icon={XCircle}
          label="Failed or partial"
          value={stats.failures}
          detail="Needs operator review"
        />
        <AutomationMetric
          icon={ListChecks}
          label="Recent evaluations"
          value={recentRuns.length}
          detail="Latest run records"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="h-4 w-4" />
              Rule builder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AutomationRulesManager orgId={orgId} initialRules={rules} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4" />
              Recent automation runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentRuns.length === 0 ? (
              <div className="rounded-md border border-dashed p-5 text-sm text-slate-500">
                No automation runs have been recorded for this organization yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentRuns.map((run) => (
                  <div
                    key={run.id}
                    className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              run.status === 'SUCCESS'
                                ? 'outline'
                                : 'destructive'
                            }
                          >
                            {run.status}
                          </Badge>
                          <Badge variant="secondary">{run.triggerOn}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {run.matched ? 'Matched' : 'Skipped'} ·{' '}
                          {run.actionsExecuted ?? 0} actions ·{' '}
                          {run.durationMs ?? 0}ms
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-slate-500">
                        {formatDateTime(run.createdAt)}
                      </span>
                    </div>
                    {run.error && (
                      <p className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                        {run.error}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function AutomationMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-500">{label}</span>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function formatDateTime(value: Date | null) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}
