import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { notFound } from 'next/navigation';
import { CustomerTicketForm } from '@/components/customer/ticket-form';
import { CustomerPortalShell } from '@/components/customer/portal-shell';

export default async function CustomerNewTicketPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const org = await getOrgBySubdomain(subdomain);

  if (!org) {
    notFound();
  }

  try {
    await requireOrgMemberRole(org.id);

    return (
      <CustomerPortalShell subdomain={subdomain}>
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Create New Ticket</h1>
            <p className="mt-1 text-sm text-gray-600">
              Submit a new support request
            </p>
          </div>

          <CustomerTicketForm orgId={org.id} subdomain={subdomain} />
        </div>
      </CustomerPortalShell>
    );
  } catch {
    // Not authenticated or not a member
    return (
      <CustomerPortalShell subdomain={subdomain}>
        <div className="flex items-center justify-center py-12">
          <div className="w-full max-w-md text-center">
            <p className="text-sm text-gray-600">
              Please sign in to create a ticket.
            </p>
          </div>
        </div>
      </CustomerPortalShell>
    );
  }
}
