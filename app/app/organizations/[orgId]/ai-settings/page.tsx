import { notFound } from 'next/navigation';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireOrgRole } from '@/lib/auth/permissions';
import { AISettingsForm } from '@/components/organizations/ai-settings-form';
import { AIMemoryManager } from '@/components/organizations/ai-memory-manager';
import { getOrgAIConfigAction, getOrgAIMemoriesAction } from '@/app/app/actions/ai-settings';

interface AISettingsPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function AISettingsPage({ params }: AISettingsPageProps) {
  const { orgId } = await params;

  // Verify org exists and user has access
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) {
    notFound();
  }

  // Load AI config and memories
  const [config, memories] = await Promise.all([
    getOrgAIConfigAction(orgId),
    getOrgAIMemoriesAction(orgId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Configuration</h1>
        <p className="text-gray-500">
          Configure Zeus AI assistant for {org.name}
        </p>
      </div>

      <AISettingsForm orgId={orgId} initialConfig={config} />
      <AIMemoryManager orgId={orgId} initialMemories={memories} />
    </div>
  );
}
