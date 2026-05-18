import { db } from "@/db";
import {
  tickets,
  ticketMessages,
  ticketEvents,
  organizations,
} from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/permissions";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { addCustomerComment } from "@/app/actions/tickets";
import { ReplyComposer } from "@/components/tickets/reply-composer";
import { TicketPropertiesOptimistic } from "@/components/tickets/ticket-properties-optimistic";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ slug: string; number: string }>;
}) {
  const session = await requireAuth();
  const { slug, number } = await params;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, slug),
  });

  if (!org) notFound();

  const ticket = await db.query.tickets.findFirst({
    where: and(eq(tickets.orgId, org.id), eq(tickets.number, parseInt(number))),
  });

  if (!ticket) notFound();

  const messages = await db.query.ticketMessages.findMany({
    where: eq(ticketMessages.ticketId, ticket.id),
    orderBy: [asc(ticketMessages.createdAt)],
  });

  const events = await db.query.ticketEvents.findMany({
    where: eq(ticketEvents.ticketId, ticket.id),
    orderBy: [asc(ticketEvents.createdAt)],
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{ticket.title}</h1>
          <p className="text-muted-foreground mt-1">
            {ticket.key} • {ticket.status} • {ticket.priority}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card className="p-4 prose max-w-none">
            <p>{ticket.descriptionMd}</p>
          </Card>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Conversation</h3>
            {messages.map((msg) => (
              <Card
                key={msg.id}
                className={`p-4 ${msg.visibility === "internal" ? "bg-amber-50 border-amber-200" : ""}`}
              >
                <div className="flex justify-between text-sm mb-2 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {msg.authorKind === "user" ? "User" : "System"}
                  </span>
                  <span>{msg.createdAt?.toLocaleString()}</span>
                </div>
                <div className="prose max-w-none">{msg.bodyMd}</div>
              </Card>
            ))}
          </div>

          <Card className="p-4">
            <ReplyComposer ticketId={ticket.id} orgId={org.id} slug={slug} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Properties</h3>
            <TicketPropertiesOptimistic
              ticketId={ticket.id}
              orgId={org.id}
              initialStatus={ticket.status}
              initialPriority={ticket.priority}
              initialType={ticket.type}
            />
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-4">Activity Log</h3>
            <ul className="space-y-3 text-sm">
              {events.map((ev) => (
                <li key={ev.id} className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {ev.eventType}
                  </span>
                  <br />
                  <span className="text-xs">
                    {ev.createdAt?.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
