import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { getTickets } from '@/lib/tickets/queries';
import { notFound } from 'next/navigation';
import { TicketList } from '@/components/tickets/ticket-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CustomerPortalShell } from '@/components/customer/portal-shell';

export default async function CustomerTicketsPage({
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
    const { user } = await requireOrgMemberRole(org.id);
    const tickets = await getTickets({ orgId: org.id, requesterId: user.id });

    // Track session activity for authenticated users
    // Track session activity
    const { trackSessionActivity } = await import('@/lib/auth/session-tracking');
    await trackSessionActivity(user.id);

    return (
      <CustomerPortalShell subdomain={subdomain}>
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">My Tickets</h1>
            <Link href={`/s/${subdomain}/tickets/new`}>
              <Button>Create Request</Button>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Your Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketList tickets={tickets} basePath={`/s/${subdomain}/tickets`} />
            </CardContent>
          </Card>
        </div>
      </CustomerPortalShell>
    );
  } catch (error) {
    console.error('[CustomerTicketsPage] Error:', error);
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
                Please sign in to access your tickets.
              </p>
              <p className="text-xs text-red-500 mt-2">
                Debug: {(error as Error).message}
              </p>
            </CardContent>
          </Card>
        </div>
      </CustomerPortalShell>
    );
  }
}
