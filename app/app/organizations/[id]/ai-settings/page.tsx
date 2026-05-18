import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireInternalRole } from "@/lib/auth/permissions";
import {
  getOrgAIConfigAction,
  getOrgAIMemoriesAction,
} from "@/app/app/actions/ai-settings";
import { AISettingsForm } from "@/components/organizations/ai-settings-form";
import { AIMemoryManager } from "@/components/organizations/ai-memory-manager";

export default async function OrganizationAISettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireInternalRole();
  const { id: orgId } = await params;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { id: true, name: true },
  });

  if (!org) {
    notFound();
  }

  const [config, memories] = await Promise.all([
    getOrgAIConfigAction(orgId),
    getOrgAIMemoriesAction(orgId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/organizations/${orgId}`}
          className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
        >
          Back to organization
        </Link>
        <h1 className="text-2xl font-bold">AI Settings</h1>
        <p className="text-sm text-gray-600">
          Configure AI behavior and data access for {org.name}.
        </p>
      </div>

      <AISettingsForm orgId={orgId} initialConfig={config} />
      <AIMemoryManager orgId={orgId} initialMemories={memories} />
    </div>
  );
}
