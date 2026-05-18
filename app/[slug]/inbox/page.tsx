import { db } from "@/db";
import { tickets, organizations } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/permissions";
import { notFound } from "next/navigation";
import InboxClient from "./inbox-client";

export default async function InboxPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAuth();
  const { slug } = await params;

  // Resolve org
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, slug),
  });

  if (!org) {
    notFound();
  }

  // Fetch initial tickets for the list
  const initialTickets = await db.query.tickets.findMany({
    where: eq(tickets.orgId, org.id),
    orderBy: [desc(tickets.createdAt)],
    limit: 50,
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <InboxClient initialTickets={initialTickets} orgId={org.id} slug={slug} />
    </div>
  );
}
