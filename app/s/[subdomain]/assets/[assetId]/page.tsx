import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { assets, ticketAssets } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils/date';

export default async function CustomerAssetDetailPage({
  params,
}: {
  params: Promise<{ subdomain: string; assetId: string }>;
}) {
  const { subdomain, assetId } = await params;
  const org = await getOrgBySubdomain(subdomain);

  if (!org) {
    notFound();
  }

  try {
    await requireOrgMemberRole(org.id, ['CUSTOMER_ADMIN']);

    const asset = await db.query.assets.findFirst({
      where: and(eq(assets.id, assetId), eq(assets.orgId, org.id)),
      with: {
        site: true,
        area: true,
      },
    });

    if (!asset) {
      notFound();
    }

    const linkedTickets = await db.query.ticketAssets.findMany({
      where: eq(ticketAssets.assetId, assetId),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      with: {
        ticket: {
          columns: {
            id: true,
            key: true,
            subject: true,
            status: true,
            priority: true,
            createdAt: true,
          },
        },
      },
    });

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link
            href={`/s/${subdomain}/assets`}
            className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
          >
            ← Back to assets
          </Link>
          <h1 className="text-2xl font-bold">{asset.name}</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Asset Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{asset.type}</Badge>
              <Badge variant="outline">{asset.status}</Badge>
              {asset.site && <Badge variant="secondary">{(asset.site as { name: string }).name}</Badge>}
              {asset.area && <Badge variant="secondary">{(asset.area as { name: string }).name}</Badge>}
            </div>
            {asset.hostname && <p>Hostname: {asset.hostname}</p>}
            {asset.ipAddress && <p>IP Address: {asset.ipAddress}</p>}
            {asset.serialNumber && <p>Serial Number: {asset.serialNumber}</p>}
            {asset.model && <p>Model: {asset.model}</p>}
            {asset.vendor && <p>Vendor: {asset.vendor}</p>}
            {asset.macAddress && <p>MAC Address: {asset.macAddress}</p>}
            {asset.tags && asset.tags.length > 0 && (
              <p>Tags: {asset.tags.join(', ')}</p>
            )}
            {asset.notes && (
              <p className="whitespace-pre-wrap text-gray-700">{asset.notes}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {linkedTickets.length === 0 ? (
              <p className="text-sm text-gray-500">No tickets linked yet.</p>
            ) : (
              linkedTickets.map((link) => {
                const ticket = link.ticket as { id: string; key: string; subject: string; status: string; priority: string } | undefined;
                return ticket ? (
                  <div key={ticket.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Link
                          href={`/s/${subdomain}/tickets/${ticket.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {ticket.key}
                        </Link>
                        <p className="text-xs text-gray-500">{ticket.subject}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline">{ticket.status}</Badge>
                        <Badge variant="outline">{ticket.priority}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Linked {formatDateTime(link.createdAt)}
                    </p>
                  </div>
                ) : null;
              })
            )}
          </CardContent>
        </Card>
      </div>
    );
  } catch {
    return (
      <div className="mx-auto max-w-md py-12">
        <Card>
          <CardHeader>
            <CardTitle>Access Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Customer admins can view asset details.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
}
