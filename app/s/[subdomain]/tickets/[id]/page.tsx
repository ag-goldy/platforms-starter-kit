import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole, canViewTicket } from '@/lib/auth/permissions';
import { getTicketById } from '@/lib/tickets/queries';
import { notFound } from 'next/navigation';
import { CustomerTicketDetail } from '@/components/customer/ticket-detail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomerPortalShell } from '@/components/customer/portal-shell';

export default async function CustomerTicketDetailPage({
  params,
}: {
  params: Promise<{ subdomain: string; id: string }>;
}) {
  const { subdomain, id } = await params;
  const org = await getOrgBySubdomain(subdomain);

  if (!org) {
    notFound();
  }

  try {
    await requireOrgMemberRole(org.id);
    
    // Verify user can view this ticket
    const result = await canViewTicket(id);
    
    // Ensure ticket belongs to user's org
    if (result.ticket.orgId !== org.id) {
      notFound();
    }

    const ticket = await getTicketById(id);

    if (!ticket) {
      notFound();
    }

    return (
      <CustomerPortalShell subdomain={subdomain}>
        <div className="mx-auto max-w-4xl space-y-6">
          <CustomerTicketDetail ticket={ticket} subdomain={subdomain} />
        </div>
      </CustomerPortalShell>
    );
  } catch {
    // Not authenticated or not a member
    return (
      <CustomerPortalShell subdomain={subdomain}>
        <div className="flex items-center justify-center py-12">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Access Required</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Please sign in to access this ticket.
              </p>
            </CardContent>
          </Card>
        </div>
      </CustomerPortalShell>
    );
  }
}
