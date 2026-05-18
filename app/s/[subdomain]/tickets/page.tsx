import { auth } from "@/auth";
import { db } from "@/db";
import {
  organizations,
  tickets,
  memberships,
  ticketComments,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, AlertCircle } from "lucide-react";
import Link from "next/link";
import { TicketSplitView } from "../components/TicketSplitView";

interface TicketsPageProps {
  params: Promise<{ subdomain: string }>;
}

export default async function TicketsPage({ params }: TicketsPageProps) {
  const { subdomain } = await params;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.subdomain, subdomain),
  });

  if (!org) {
    notFound();
  }

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const userMembership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, session.user.id),
      eq(memberships.orgId, org.id),
      eq(memberships.isActive, true),
    ),
  });

  if (!userMembership) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-20 h-20 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-orange-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-6">
          You don&apos;t have access to this organization&apos;s tickets.
        </p>
        <Link href={`/s/${subdomain}`}>
          <Button
            variant="outline"
            className="border-gray-200 hover:bg-gray-50 text-gray-900"
          >
            Go Back
          </Button>
        </Link>
      </div>
    );
  }

  // Fetch tickets with comments for the split view
  const userTickets = await db.query.tickets.findMany({
    where:
      userMembership.role === "CUSTOMER_ADMIN"
        ? eq(tickets.orgId, org.id)
        : and(
            eq(tickets.orgId, org.id),
            eq(tickets.requesterId, session.user.id),
          ),
    orderBy: [desc(tickets.updatedAt)],
    with: {
      assignee: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      requester: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      comments: {
        orderBy: [desc(ticketComments.createdAt)],
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  // Transform to match the component's expected format
  const formattedTickets = userTickets
    .filter((ticket) => ticket.status !== "MERGED")
    .map((ticket) => ({
      ...ticket,
      status: ticket.status as
        | "NEW"
        | "OPEN"
        | "IN_PROGRESS"
        | "WAITING_ON_CUSTOMER"
        | "RESOLVED"
        | "CLOSED",
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      comments: (ticket.comments || []).map((comment) => ({
        ...comment,
        createdAt: comment.createdAt.toISOString(),
      })),
      requester:
        ticket.requester ||
        (session.user
          ? {
              name: session.user.name ?? null,
              email: session.user.email,
            }
          : null),
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-950 tracking-tight">
            {userMembership.role === "CUSTOMER_ADMIN"
              ? "Team Requests"
              : "My Requests"}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {userMembership.role === "CUSTOMER_ADMIN"
              ? "Monitor customer-facing requests across your organization"
              : "View, reply to, and manage your support requests"}
          </p>
        </div>
        <Link href={`/s/${subdomain}/tickets/new`}>
          <Button className="bg-black hover:bg-gray-800 text-white rounded-xl h-11 px-6 shadow-sm hover:shadow-md transition-all">
            <Plus className="w-4 h-4 mr-2 text-orange-500" />
            New Ticket
          </Button>
        </Link>
      </div>

      {/* Outlook-style Split View */}
      <TicketSplitView
        subdomain={subdomain}
        initialTickets={formattedTickets}
      />
    </div>
  );
}
