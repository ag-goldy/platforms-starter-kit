import { auth } from '@/auth';
import { db } from '@/db';
import { organizations, tickets, memberships, ticketComments } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft,
  Clock,
  User,
  Tag,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Calendar,
  Paperclip
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { TicketAIInsight } from '@/components/tickets/ticket-ai-insight';
import { getCachedOrFetch } from '@/lib/performance/cache';

interface TicketDetailPageProps {
  params: Promise<{ subdomain: string; id: string }>;
}

export default async function TicketDetailPage({ params }: TicketDetailPageProps) {
  const { subdomain, id } = await params;

  const org = await getCachedOrFetch(
    `org:${subdomain}`,
    () => db.query.organizations.findFirst({
      where: eq(organizations.subdomain, subdomain),
    }),
    5 * 60 * 1000
  );

  if (!org) {
    notFound();
  }

  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const userMembership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, session.user.id),
      eq(memberships.orgId, org.id),
      eq(memberships.isActive, true)
    ),
  });

  const ticket = await db.query.tickets.findFirst({
    where: and(
      eq(tickets.id, id),
      eq(tickets.orgId, org.id)
    ),
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

  // Cast ticket to any to avoid type inference issues with Drizzle relations
  const typedTicket = ticket as any;

  const statusConfig = getStatusConfig(typedTicket.status);
  const priorityColors: Record<string, string> = {
    P4: 'bg-gray-100 text-gray-700',
    P3: 'bg-yellow-100 text-yellow-700',
    P2: 'bg-orange-100 text-orange-700',
    P1: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link 
        href={`/s/${subdomain}/tickets`}
        className="inline-flex items-center gap-2 text-gray-600 hover:text-orange-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to tickets
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${statusConfig.style}`}>
                {statusConfig.icon}
                {typedTicket.status.replace('_', ' ')}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${priorityColors[typedTicket.priority] || priorityColors.P4}`}>
                {typedTicket.priority} Priority
              </span>
              <span className="text-gray-400 text-sm">#{typedTicket.id.slice(0, 8)}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{typedTicket.subject}</h1>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Created on</p>
            <p className="font-medium text-gray-900">{new Date(typedTicket.createdAt).toLocaleDateString('en-US', { 
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-orange-500" />
              Description
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{typedTicket.description || 'No description provided.'}</p>
            </div>
          </div>

          {/* AI Analysis */}
          <TicketAIInsight ticketId={typedTicket.id} />

          {/* Comments */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-orange-500" />
              Conversation
              <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-sm">
                {typedTicket.comments.length}
              </span>
            </h2>

            {typedTicket.comments.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No comments yet</p>
                <p className="text-sm text-gray-400">Be the first to add a comment</p>
              </div>
            ) : (
              <div className="space-y-6">
                {typedTicket.comments.map((comment: any) => (
                  <CommentCard key={comment.id} comment={comment} />
                ))}
              </div>
            )}

            {/* Add Comment */}
            <Separator className="my-6" />
            <form action={`/api/customer/tickets/${typedTicket.id}/comments`} method="POST" className="space-y-4">
              <Textarea 
                name="content"
                placeholder="Add a comment..."
                className="min-h-[120px] resize-none border-gray-200 focus:border-orange-500 focus:ring-orange-500"
              />
              <div className="flex justify-end">
                <Button 
                  type="submit"
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Post Comment
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ticket Info */}
          <div className="bg-gray-50 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Ticket Details</h3>
            <div className="space-y-4">
              <InfoRow icon={<User className="w-4 h-4" />} label="Requester" value={session.user.email || 'Unknown'} />
              <InfoRow icon={<Tag className="w-4 h-4" />} label="Category" value={typedTicket.category} />
              <InfoRow icon={<Clock className="w-4 h-4" />} label="Status" value={typedTicket.status.replace('_', ' ')} />
              <InfoRow icon={<AlertCircle className="w-4 h-4" />} label="Priority" value={typedTicket.priority} />
              {typedTicket.assignee && (
                <InfoRow icon={<User className="w-4 h-4" />} label="Assigned to" value={typedTicket.assignee.name || typedTicket.assignee.email} />
              )}
            </div>
          </div>

          {/* SLA Info */}
          <div className="bg-black rounded-2xl p-6">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Response Time
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">First response</span>
                <span className="text-sm font-medium text-white">Within 4 hours</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Resolution</span>
                <span className="text-sm font-medium text-orange-500">{typedTicket.priority === 'P1' ? '24 hours' : '48 hours'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentCard({ comment }: { comment: any }) {
  const isStaff = comment.user?.role === 'ADMIN' || comment.user?.role === 'AGENT';
  const initials = comment.user?.name?.slice(0, 2).toUpperCase() || 
                   comment.user?.email?.slice(0, 2).toUpperCase() || '??';

  return (
    <div className="flex gap-4">
      <Avatar className="w-10 h-10 flex-shrink-0">
        <AvatarFallback className={isStaff ? 'bg-black text-orange-500' : 'bg-gray-100 text-gray-700'}>
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="bg-gray-50 rounded-2xl rounded-tl-none p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-gray-900">
              {comment.user?.name || comment.user?.email || 'Unknown'}
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

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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
      style: 'bg-orange-500 text-white border-orange-600',
      icon: <AlertCircle className="w-4 h-4" />,
    },
    IN_PROGRESS: {
      style: 'bg-black text-white border-gray-800',
      icon: <Clock className="w-4 h-4" />,
    },
    RESOLVED: {
      style: 'bg-white text-gray-900 border-gray-200',
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    CLOSED: {
      style: 'bg-gray-100 text-gray-500 border-gray-200',
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
  };
  return configs[status] || configs.CLOSED;
}
