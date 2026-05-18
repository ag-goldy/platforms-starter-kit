import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { BookOpen, Clock3, MessageSquarePlus, PanelLeft, Ticket } from 'lucide-react';
import { db } from '@/db';
import { kbArticles, requestTypes, tickets } from '@/db/schema';
import { requirePortalAccess } from '@/lib/portal/access';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function CustomerPortalHome({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const access = await requirePortalAccess(subdomain);
  if (!access) notFound();

  const visibleTicketWhere = access.isCustomerAdmin
    ? eq(tickets.orgId, access.org.id)
    : and(eq(tickets.orgId, access.org.id), eq(tickets.requesterId, access.user.id));

  const [openTickets, recentArticles, catalogItems] = await Promise.all([
    db.query.tickets.findMany({
      where: and(
        visibleTicketWhere,
        inArray(tickets.status, ['NEW', 'OPEN', 'WAITING_ON_CUSTOMER', 'IN_PROGRESS', 'RESOLVED'])
      ),
      orderBy: [desc(tickets.updatedAt)],
      limit: 6,
      with: {
        requester: { columns: { id: true, name: true, email: true } },
        assignee: { columns: { id: true, name: true, email: true } },
      },
    }),
    db.query.kbArticles.findMany({
      where: and(
        eq(kbArticles.orgId, access.org.id),
        eq(kbArticles.status, 'published'),
        eq(kbArticles.visibility, 'public')
      ),
      orderBy: [desc(kbArticles.updatedAt)],
      limit: 4,
    }),
    db.query.requestTypes.findMany({
      where: and(eq(requestTypes.orgId, access.org.id), eq(requestTypes.isActive, true)),
      orderBy: (table, { asc }) => [asc(table.name)],
      limit: 5,
    }),
  ]);

  const displayName = access.user.name?.split(' ')[0] || 'there';
  const orgName = access.org.branding?.nameOverride || access.org.name;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-orange-600">
            <Ticket className="h-4 w-4" />
            {orgName}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Hi {displayName}, track every request from one place.</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Create support requests, follow status updates, reply to your team, and use approved knowledge and service catalog forms published by Atlas admins.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/s/${subdomain}/tickets/new`}>
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                New request
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/s/${subdomain}/kb`}>
                <BookOpen className="mr-2 h-4 w-4" />
                Search knowledge
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-md border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Visible requests</div>
            <div className="mt-1 text-2xl font-semibold">{openTickets.length}</div>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Knowledge articles</div>
            <div className="mt-1 text-2xl font-semibold">{recentArticles.length}</div>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Catalog forms</div>
            <div className="mt-1 text-2xl font-semibold">{catalogItems.length}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{access.isCustomerAdmin ? 'Team request monitor' : 'My request monitor'}</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Latest status, ownership, and customer-visible lifecycle state.</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/s/${subdomain}/tickets`}>View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {openTickets.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                No open requests right now.
              </div>
            ) : (
              openTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/s/${subdomain}/tickets/${ticket.id}`}
                  className="grid gap-3 rounded-md border border-slate-200 p-3 transition-colors hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_130px_150px]"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-slate-500">{ticket.key}</div>
                    <div className="truncate text-sm font-medium">{ticket.subject}</div>
                    {access.isCustomerAdmin && (
                      <div className="truncate text-xs text-slate-500">
                        {ticket.requester?.name || ticket.requester?.email || 'Requester unknown'}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="w-fit self-center">{ticket.status}</Badge>
                  <div className="flex items-center gap-2 text-xs text-slate-500 md:justify-end">
                    <Clock3 className="h-3.5 w-3.5" />
                    {ticket.updatedAt.toLocaleDateString()}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Service catalog</CardTitle>
              <PanelLeft className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className="space-y-3">
              {catalogItems.length === 0 ? (
                <p className="text-sm text-slate-500">No request forms are published yet.</p>
              ) : (
                catalogItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/s/${subdomain}/tickets/new?requestType=${item.slug}`}
                    className="block rounded-md border border-slate-200 p-3 hover:bg-slate-50"
                  >
                    <div className="text-sm font-medium">{item.name}</div>
                    {item.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description}</p>}
                  </Link>
                ))
              )}
              <Button asChild variant="outline" className="w-full">
                <Link href={`/s/${subdomain}/services`}>Browse catalog</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Knowledge shortcuts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentArticles.length === 0 ? (
                <p className="text-sm text-slate-500">No published articles yet.</p>
              ) : (
                recentArticles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/s/${subdomain}/kb/${article.slug}`}
                    className="block rounded-md border border-slate-200 p-3 hover:bg-slate-50"
                  >
                    <div className="text-sm font-medium">{article.title}</div>
                    {article.excerpt && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{article.excerpt}</p>}
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
