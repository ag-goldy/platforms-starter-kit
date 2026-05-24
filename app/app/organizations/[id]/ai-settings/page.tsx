import type { ComponentType } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { aiAuditLog, organizations } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { requireInternalRole } from '@/lib/auth/permissions';
import {
  getOrgAIConfigAction,
  getOrgAIMemoriesAction,
} from '@/app/app/actions/ai-settings';
import { AISettingsForm } from '@/components/organizations/ai-settings-form';
import { AIMemoryManager } from '@/components/organizations/ai-memory-manager';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Bot,
  Brain,
  FileWarning,
  History,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export default async function OrganizationAISettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireInternalRole();
  const { id: orgId } = await params;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { id: true, name: true, subdomain: true },
  });

  if (!org) {
    notFound();
  }

  const [config, memories, auditStats, recentAudit] = await Promise.all([
    getOrgAIConfigAction(orgId),
    getOrgAIMemoriesAction(orgId),
    db
      .select({
        total: sql<number>`count(*)::int`,
        lastDay: sql<number>`count(*) filter (where ${aiAuditLog.createdAt} >= now() - interval '24 hours')::int`,
        piiDetected: sql<number>`count(*) filter (where ${aiAuditLog.piiDetected} = true)::int`,
        filtered: sql<number>`count(*) filter (where ${aiAuditLog.wasFiltered} = true)::int`,
      })
      .from(aiAuditLog)
      .where(eq(aiAuditLog.orgId, orgId)),
    db
      .select({
        id: aiAuditLog.id,
        interface: aiAuditLog.interface,
        piiDetected: aiAuditLog.piiDetected,
        wasFiltered: aiAuditLog.wasFiltered,
        responseTimeMs: aiAuditLog.responseTimeMs,
        createdAt: aiAuditLog.createdAt,
      })
      .from(aiAuditLog)
      .where(eq(aiAuditLog.orgId, orgId))
      .orderBy(desc(aiAuditLog.createdAt))
      .limit(6),
  ]);

  const stats = auditStats[0] ?? {
    total: 0,
    lastDay: 0,
    piiDetected: 0,
    filtered: 0,
  };
  const activeMemories = memories.filter((memory) => memory.isActive).length;
  const dataAccessCount = [
    config.allowKBAccess,
    config.allowTicketSummaries,
    config.allowAssetInfo,
    config.allowServiceStatus,
  ].filter(Boolean).length;

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
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {org.subdomain}
              </Badge>
              <Badge variant={config.aiEnabled ? 'default' : 'secondary'}>
                AI {config.aiEnabled ? 'enabled' : 'disabled'}
              </Badge>
              <Badge
                variant="outline"
                className={
                  config.blockPIIInResponses
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }
              >
                PII guard {config.blockPIIInResponses ? 'on' : 'off'}
              </Badge>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              AI governance
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Control AI availability, tenant data access, customer limits,
              memory, and audit posture for {org.name}.
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3 xl:min-w-[560px]">
            <AIMetric
              icon={MessageSquareText}
              label="AI calls"
              value={stats.total}
              detail={`${stats.lastDay} in 24h`}
            />
            <AIMetric
              icon={Brain}
              label="Active memory"
              value={activeMemories}
              detail={`${memories.length} total memories`}
            />
            <AIMetric
              icon={LockKeyhole}
              label="Data scopes"
              value={`${dataAccessCount}/4`}
              detail="Enabled sources"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <AIMetric
          icon={ShieldCheck}
          label="Filtered outputs"
          value={stats.filtered}
          detail="Guardrail interventions"
        />
        <AIMetric
          icon={FileWarning}
          label="PII detections"
          value={stats.piiDetected}
          detail="Audit events flagged"
        />
        <AIMetric
          icon={Bot}
          label="Customer limit"
          value={config.customerRateLimit ?? 50}
          detail="Requests per user per hour"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <AISettingsForm orgId={orgId} initialConfig={config} />
          <AIMemoryManager orgId={orgId} initialMemories={memories} />
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                Policy posture
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <PolicyRow label="Customer portal AI" enabled={config.customerAIEnabled} />
              <PolicyRow label="KB access" enabled={config.allowKBAccess} />
              <PolicyRow label="Ticket summaries" enabled={config.allowTicketSummaries} />
              <PolicyRow label="Asset context" enabled={config.allowAssetInfo} />
              <PolicyRow label="Service status" enabled={config.allowServiceStatus} />
              <PolicyRow label="Internal notes in AI" enabled={config.includeInternalNotesInAI} inverted />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                Recent AI audit
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentAudit.length === 0 ? (
                <div className="rounded-md border border-dashed p-5 text-sm text-slate-500">
                  No AI audit events have been recorded for this organization.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentAudit.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{event.interface}</Badge>
                          {event.wasFiltered && (
                            <Badge variant="outline">Filtered</Badge>
                          )}
                          {event.piiDetected && (
                            <Badge variant="destructive">PII</Badge>
                          )}
                        </div>
                        <span className="whitespace-nowrap text-xs text-slate-500">
                          {formatDateTime(event.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Response time: {event.responseTimeMs ?? 0}ms
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <Link
                href="/app/admin/ai-audit"
                className="mt-4 inline-flex text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
              >
                Open full AI audit
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function AIMetric({
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

function PolicyRow({
  label,
  enabled,
  inverted = false,
}: {
  label: string;
  enabled: boolean;
  inverted?: boolean;
}) {
  const healthy = inverted ? !enabled : enabled;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <Badge
        variant="outline"
        className={
          healthy
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-amber-200 bg-amber-50 text-amber-700'
        }
      >
        {enabled ? 'Enabled' : 'Disabled'}
      </Badge>
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
