import { getAutomationRulesAction } from '@/app/app/actions/automation';
import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { AutomationRulesManager } from '@/components/automation/rules-manager';
import Link from 'next/link';

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

  const rules = await getAutomationRulesAction(orgId);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/organizations/${orgId}`}
          className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
        >
          ← Back to organization
        </Link>
        <h1 className="text-2xl font-bold">Automation Rules</h1>
        <p className="text-muted-foreground mt-1">
          Configure automated workflows for {org.name}
        </p>
      </div>

      <AutomationRulesManager orgId={orgId} initialRules={rules} />
    </div>
  );
}

