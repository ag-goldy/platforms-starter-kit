import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole, canViewTicket } from '@/lib/auth/permissions';
import { getTicketById } from '@/lib/tickets/queries';
import { notFound } from 'next/navigation';
import { CustomerTicketDetail } from '@/components/customer/ticket-detail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type Ticket, type TicketComment, type Attachment, type Asset, type Site, type Area, assets } from '@/db/schema';
import { db } from '@/db';
import { eq } from 'drizzle-orm';

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
    const { membership } = await requireOrgMemberRole(org.id);
    const isAdmin = membership.role === 'CUSTOMER_ADMIN';
    
    // Verify user can view this ticket
    const result = await canViewTicket(id);
    
    // Ensure ticket belongs to user's org
    if (result.ticket.orgId !== org.id) {
      notFound();
    }

    const ticket = await getTicketById(id, org.id);

    if (!ticket) {
      notFound();
    }

    const availableAssets = isAdmin
      ? await db.query.assets.findMany({
          where: eq(assets.orgId, org.id),
          orderBy: (table, { asc }) => [asc(table.name)],
          with: {
            site: true,
            area: true,
          },
        })
      : [];

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <CustomerTicketDetail ticket={ticket as unknown as Ticket & {
          organization: { name: string };
          requester: { name: string | null; email: string } | null;
          assignee: { name: string | null; email: string } | null;
          comments: (TicketComment & {
            user: { name: string | null; email: string } | null;
          })[];
          attachments: Attachment[];
        }} subdomain={subdomain} availableAssets={availableAssets as (Asset & { site?: Site | null; area?: Area | null })[]} canEditAssets={isAdmin} />
      </div>
    );
  } catch (error) {
    console.error('[CustomerTicketDetailPage] Error:', error);
    // Not authenticated or not a member
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Please sign in to access this ticket.
            </p>
            <p className="text-xs text-red-500 mt-2">
              Debug: {(error as Error).message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
}
