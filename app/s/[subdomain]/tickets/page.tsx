import { auth } from '@/auth';
import { db } from '@/db';
import { organizations, tickets, memberships } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  MessageSquare, 
  Filter,
  Search,
  ArrowRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Zap
} from 'lucide-react';
import { getCachedOrFetch } from '@/lib/performance/cache';
import { Input } from '@/components/ui/input';

interface TicketsPageProps {
  params: Promise<{ subdomain: string }>;
}

export default async function TicketsPage({ params }: TicketsPageProps) {
  const { subdomain } = await params;

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

  if (!userMembership) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-20 h-20 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-orange-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-6">You don&apos;t have access to this organization&apos;s tickets.</p>
        <Link href={`/s/${subdomain}`}>
          <Button variant="outline" className="border-gray-200 hover:bg-gray-50 text-gray-900">Go Back</Button>
        </Link>
      </div>
    );
  }

  const userTickets = await db.query.tickets.findMany({
    where: and(
      eq(tickets.orgId, org.id),
      eq(tickets.requesterId, session.user.id)
    ),
    orderBy: [desc(tickets.updatedAt)],
    with: {
      assignee: true,
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">My Tickets</h1>
          <p className="text-gray-500 mt-1 font-medium">
            {userTickets.length} {userTickets.length === 1 ? 'ticket' : 'tickets'} found
          </p>
        </div>
        <Link href={`/s/${subdomain}/tickets/new`}>
          <Button className="bg-black hover:bg-gray-800 text-white rounded-xl h-11 px-6 shadow-sm hover:shadow-md transition-all">
            <Plus className="w-4 h-4 mr-2 text-orange-500" />
            New Ticket
          </Button>
        </Link>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input 
            placeholder="Search tickets by ID, subject, or content..."
            className="pl-12 h-12 bg-white border-gray-200 focus:border-black focus:ring-black rounded-xl text-base"
          />
        </div>
        <Button variant="outline" className="h-12 px-6 rounded-xl border-gray-200 hover:bg-gray-50 text-gray-700">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      {/* Tickets List */}
      {userTickets.length === 0 ? (
        <EmptyState subdomain={subdomain} />
      ) : (
        <div className="grid gap-4">
          {userTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} subdomain={subdomain} />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket, subdomain }: { ticket: any; subdomain: string }) {
  const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
    OPEN: { 
      color: 'text-orange-500', 
      bg: 'bg-black',
      icon: <AlertCircle className="w-5 h-5" />
    },
    IN_PROGRESS: { 
      color: 'text-gray-900', 
      bg: 'bg-gray-100',
      icon: <Clock className="w-5 h-5" />
    },
    RESOLVED: { 
      color: 'text-gray-500', 
      bg: 'bg-gray-50',
      icon: <CheckCircle className="w-5 h-5" />
    },
    CLOSED: { 
      color: 'text-gray-400', 
      bg: 'bg-gray-50',
      icon: <CheckCircle className="w-5 h-5" />
    },
  };

  const config = statusConfig[ticket.status] || statusConfig.CLOSED;
  
  // P1-P4 Priority Mapping
  const priorityLabels: Record<string, string> = {
    P1: 'Critical',
    P2: 'High',
    P3: 'Normal',
    P4: 'Low',
  };
  
  // Map legacy priorities if needed, or use P1-P4 directly
  const displayPriority = priorityLabels[ticket.priority] || ticket.priority;
  
  const priorityStyles: Record<string, string> = {
    P1: 'bg-black text-white border-black',
    P2: 'bg-orange-100 text-orange-800 border-orange-200',
    P3: 'bg-white text-gray-700 border-gray-200',
    P4: 'bg-gray-50 text-gray-500 border-gray-100',
    // Legacy fallback
    CRITICAL: 'bg-black text-white border-black',
    HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
    MEDIUM: 'bg-white text-gray-700 border-gray-200',
    LOW: 'bg-gray-50 text-gray-500 border-gray-100',
  };

  return (
    <Link
      href={`/s/${subdomain}/tickets/${ticket.id}`}
      className="group block bg-white border border-gray-100 rounded-2xl p-6 hover:border-orange-200 hover:shadow-lg transition-all duration-300"
    >
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-5 flex-1">
          {/* Status Icon Box */}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${config.bg} ${config.color}`}>
            {config.icon}
          </div>
          
          <div className="flex-1 min-w-0 py-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                {ticket.key}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${priorityStyles[ticket.priority] || priorityStyles.P3}`}>
                {displayPriority}
              </span>
              {ticket.status === 'OPEN' && (
                <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
              )}
            </div>
            
            <h3 className="text-lg font-bold text-gray-900 group-hover:text-orange-600 transition-colors mb-2 truncate">
              {ticket.subject}
            </h3>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 font-medium">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {new Date(ticket.createdAt).toLocaleDateString()}
              </span>
              <span className="w-1 h-1 bg-gray-300 rounded-full" />
              <span>{ticket.category}</span>
              {ticket.assignee && (
                <>
                  <span className="w-1 h-1 bg-gray-300 rounded-full" />
                  <span className="flex items-center gap-1.5 text-gray-700">
                    <Zap className="w-3.5 h-3.5 text-orange-500" />
                    {ticket.assignee.name || 'Support Agent'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center self-center pl-4 border-l border-gray-50">
          <ArrowRight className="w-6 h-6 text-gray-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ subdomain }: { subdomain: string }) {
  return (
    <div className="text-center py-24 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
      <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm ring-4 ring-gray-50">
        <MessageSquare className="w-10 h-10 text-gray-300" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">No tickets yet</h3>
      <p className="text-gray-500 mb-8 max-w-md mx-auto leading-relaxed">
        You haven&apos;t submitted any support tickets yet. Create your first ticket to get fast & professional help from our team.
      </p>
      <Link href={`/s/${subdomain}/tickets/new`}>
        <Button className="bg-black hover:bg-gray-900 text-white h-12 px-8 rounded-xl shadow-lg shadow-gray-200 transition-all hover:scale-105">
          <Plus className="w-4 h-4 mr-2 text-orange-500" />
          Create First Ticket
        </Button>
      </Link>
    </div>
  );
}
