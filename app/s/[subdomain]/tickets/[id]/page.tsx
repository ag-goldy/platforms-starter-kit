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
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Clock,
  User,
  Tag,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Lock,
  Send,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { TicketAIInsight } from "@/components/tickets/ticket-ai-insight";
import { getCachedOrFetch } from "@/lib/performance/cache";
import {
  addCustomerTicketCommentAction,
  closeCustomerTicketAction,
} from "../../actions/tickets";

interface TicketDetailPageProps {
  params: Promise<{ subdomain: string; id: string }>;
}

export default async function TicketDetailPage({
  params,
}: TicketDetailPageProps) {
  const { subdomain, id } = await params;

  const org = await getCachedOrFetch(
    `org:${subdomain}`,
    () =>
      db.query.organizations.findFirst({
        where: eq(organizations.subdomain, subdomain),
      }),
    5 * 60 * 1000,
  );

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

  const ticket = await db.query.tickets.findFirst({
    where: and(eq(tickets.id, id), eq(tickets.orgId, org.id)),
    with: {
      assignee: true,
      comments: {
        orderBy: [desc(ticketComments.createdAt)],
        with: {
          user: true,
        },
      },
    },
  });

  if (!ticket || (!userMembership && ticket.requesterId !== session.user.id)) {
    notFound();
  }

  // Use the ticket directly with proper typing
  const typedTicket = ticket;

  const statusConfig = getStatusConfig(typedTicket.status);
  const priorityColors: Record<string, string> = {
    P4: "bg-gray-100 text-gray-700",
    P3: "bg-yellow-100 text-yellow-700",
    P2: "bg-orange-100 text-orange-700",
    P1: "bg-red-100 text-red-700",
  };

  async function addReply(formData: FormData) {
    "use server";
    const content = formData.get("content");
    if (typeof content === "string" && content.trim()) {
      await addCustomerTicketCommentAction(id, content);
    }
  }

  async function closeTicket() {
    "use server";
    await closeCustomerTicketAction(id);
  }

  const canClose = typedTicket.status === "RESOLVED";
  const isTerminal =
    typedTicket.status === "CLOSED" || typedTicket.status === "MERGED";

  return (
    <div className="space-y-5">
      <Link
        href={`/s/${subdomain}/tickets`}
        className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-950"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to requests
      </Link>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${statusConfig.style}`}
              >
                {statusConfig.icon}
                {typedTicket.status.replaceAll("_", " ")}
              </span>
              <span
                className={`rounded-md border px-2.5 py-1 text-xs font-medium ${priorityColors[typedTicket.priority] || priorityColors.P4}`}
              >
                {typedTicket.priority}
              </span>
              <span className="font-mono text-xs text-slate-400">
                {typedTicket.key}
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
              {typedTicket.subject}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              This request timeline shows public support updates only. Internal routing, SLA, assignment, and ITSM configuration are managed by Atlas admins.
            </p>
          </div>
          <div className="grid min-w-[260px] gap-2 text-sm">
            <div className="rounded-md border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Created</div>
              <div className="mt-1 font-medium text-slate-950">
                {new Date(typedTicket.createdAt).toLocaleDateString()}
              </div>
            </div>
            {canClose && (
              <form action={closeTicket}>
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Close resolved request
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-950">
              <MessageSquare className="h-4 w-4 text-orange-500" />
              Description
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {typedTicket.description || "No description provided."}
              </p>
            </div>
          </div>

          <TicketAIInsight ticketId={typedTicket.id} />

          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-6 flex items-center gap-2 text-base font-semibold text-slate-950">
              <MessageSquare className="h-4 w-4 text-orange-500" />
              Conversation
              <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {typedTicket.comments.length}
              </span>
            </h2>

            {typedTicket.comments.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
                <MessageSquare className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm text-slate-500">No public replies yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {typedTicket.comments.map((comment) => (
                  <CommentCard key={comment.id} comment={comment} />
                ))}
              </div>
            )}

            <Separator className="my-6" />
            {isTerminal ? (
              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                <Lock className="h-4 w-4" />
                This request is closed and no longer accepts replies.
              </div>
            ) : (
              <form action={addReply} className="space-y-4">
                <Textarea
                  name="content"
                  placeholder={
                    typedTicket.status === "RESOLVED"
                      ? "Reply to reopen this resolved request..."
                      : "Add a reply..."
                  }
                  className="min-h-[120px] resize-none border-slate-200 focus:border-orange-500 focus:ring-orange-500"
                />
                <div className="flex justify-end">
                  <Button type="submit">
                    <Send className="mr-2 h-4 w-4" />
                    Post reply
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-semibold text-slate-950">Request details</h3>
            <div className="space-y-4">
              <InfoRow
                icon={<User className="w-4 h-4" />}
                label="Requester"
                value={session.user.email || "Unknown"}
              />
              <InfoRow
                icon={<Tag className="w-4 h-4" />}
                label="Category"
                value={typedTicket.category}
              />
              <InfoRow
                icon={<Clock className="w-4 h-4" />}
                label="Status"
                value={typedTicket.status.replaceAll("_", " ")}
              />
              <InfoRow
                icon={<AlertCircle className="w-4 h-4" />}
                label="Priority"
                value={typedTicket.priority}
              />
              {typedTicket.assignee && (
                <InfoRow
                  icon={<User className="w-4 h-4" />}
                  label="Assigned to"
                  value={
                    typedTicket.assignee.name || typedTicket.assignee.email
                  }
                />
              )}
            </div>
          </div>

          {/* SLA Info */}
          <div className="rounded-md bg-slate-950 p-5">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-white">
              <Clock className="h-5 w-5 text-orange-500" />
              Response Time
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">First response</span>
                <span className="text-sm font-medium text-white">
                  Within 4 hours
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Resolution</span>
                <span className="text-sm font-medium text-orange-500">
                  {typedTicket.priority === "P1" ? "24 hours" : "48 hours"}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

interface Comment {
  id: string;
  content: string;
  createdAt: string | Date;
  user?: {
    name: string | null;
    email: string;
    role?: string;
  } | null;
}

function CommentCard({ comment }: { comment: Comment }) {
  const isStaff =
    comment.user?.role === "ADMIN" || comment.user?.role === "AGENT";
  const initials =
    comment.user?.name?.slice(0, 2).toUpperCase() ||
    comment.user?.email?.slice(0, 2).toUpperCase() ||
    "??";

  return (
    <div className="flex gap-4">
      <Avatar className="w-10 h-10 flex-shrink-0">
        <AvatarFallback
          className={
            isStaff ? "bg-black text-orange-500" : "bg-gray-100 text-gray-700"
          }
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="bg-gray-50 rounded-2xl rounded-tl-none p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-gray-900">
              {comment.user?.name || comment.user?.email || "Unknown"}
            </span>
            {isStaff && (
              <span className="px-2 py-0.5 bg-black text-orange-500 text-xs font-medium rounded-full">
                Support Team
              </span>
            )}
            <span className="text-gray-400 text-sm">
              {new Date(comment.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-400 mt-0.5">{icon}</span>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function getStatusConfig(status: string) {
  const configs: Record<string, { style: string; icon: React.ReactNode }> = {
    OPEN: {
      style: "bg-orange-500 text-white border-orange-600",
      icon: <AlertCircle className="w-4 h-4" />,
    },
    NEW: {
      style: "bg-blue-50 text-blue-700 border-blue-200",
      icon: <AlertCircle className="w-4 h-4" />,
    },
    IN_PROGRESS: {
      style: "bg-black text-white border-gray-800",
      icon: <Clock className="w-4 h-4" />,
    },
    RESOLVED: {
      style: "bg-white text-gray-900 border-gray-200",
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    CLOSED: {
      style: "bg-gray-100 text-gray-500 border-gray-200",
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
  };
  return configs[status] || configs.CLOSED;
}
