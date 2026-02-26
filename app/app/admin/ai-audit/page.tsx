import { Suspense } from 'react';
import { requireInternalRole } from '@/lib/auth/permissions';
import { AIAuditDashboard } from '@/components/admin/ai-audit-dashboard';
import { AIAuditStats } from '@/components/admin/ai-audit-stats';

export const metadata = {
  title: 'AI Audit Log',
  description: 'Monitor AI interactions and security events',
};

export default async function AIAuditPage() {
  await requireInternalRole();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Audit Log</h1>
        <p className="text-gray-500">
          Monitor all AI interactions, security events, and data access across the platform
        </p>
      </div>

      <Suspense fallback={<div>Loading stats...</div>}>
        <AIAuditStats />
      </Suspense>

      <Suspense fallback={<div>Loading audit logs...</div>}>
        <AIAuditDashboard />
      </Suspense>
    </div>
  );
}
