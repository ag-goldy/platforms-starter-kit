import { requireInternalRole } from '@/lib/auth/permissions';
import { getTicketTemplates } from '@/lib/templates/queries';
import { TemplatesList } from '@/components/templates/templates-list';
import { CreateTemplateButton } from '@/components/templates/create-template-button';

export default async function TemplatesPage() {
  await requireInternalRole();
  const templates = await getTicketTemplates();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ticket Templates</h1>
          <p className="mt-1 text-sm text-gray-600">
            Create reusable templates for common ticket responses
          </p>
        </div>
        <CreateTemplateButton />
      </div>

      <TemplatesList templates={templates} />
    </div>
  );
}

