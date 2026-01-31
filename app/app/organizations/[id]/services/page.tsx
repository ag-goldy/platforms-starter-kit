import { notFound } from 'next/navigation';
import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ServiceManager } from '@/components/services/service-manager';
import { getOrgServicesAction } from '@/app/app/actions/services';

export default async function OrgServicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireInternalRole();
  const { id } = await params;
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, id),
  });
  if (!org) {
    notFound();
  }
  const services = await getOrgServicesAction(id);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Services</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage services and SLA policies for {org.name}
        </p>
      </div>
      <ServiceManager orgId={id} initialServices={services} />
    </div>
  );
}

