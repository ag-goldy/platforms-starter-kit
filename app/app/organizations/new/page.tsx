import { requireInternalRole } from '@/lib/auth/permissions';
import { createOrganizationAction } from '@/app/app/actions/organizations';
import { redirect } from 'next/navigation';
import { OrganizationForm } from '@/components/organizations/organization-form';

export default async function NewOrganizationPage() {
  await requireInternalRole();

  async function createAction(formData: FormData) {
    'use server';
    const name = formData.get('name') as string;
    const slug = formData.get('slug') as string;
    const subdomain = formData.get('subdomain') as string;

    const result = await createOrganizationAction({ name, slug, subdomain });
    redirect(`/app/organizations/${result.orgId}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Organization</h1>
      </div>
      <OrganizationForm action={createAction} />
    </div>
  );
}


