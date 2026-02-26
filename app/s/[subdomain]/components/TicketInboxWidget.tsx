'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ticket,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Clock,
  MessageSquare,
  Paperclip,
  ChevronRight,
  CheckCircle,
  Inbox,
  User,
  Bug,
} from 'lucide-react';
import { useCustomerPortal } from '@/components/customer/CustomerPortalContext';
import { useRouter, useSearchParams } from 'next/navigation';

interface TicketInboxWidgetProps {
  subdomain: string;
  org: any;
}

interface TicketItem {
  id: string;
  key: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  attachmentCount: number;
  requester: {
    name: string;
    email: string;
  };
  isUnread?: boolean;
}

type FilterTab = 'all' | 'mine' | 'waiting' | 'resolved';

export function TicketInboxWidget({ subdomain, org }: TicketInboxWidgetProps) {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const { openSlideOver } = useCustomerPortal();
  const router = useRouter();
  const searchParams = useSearchParams();

  const runDiagnostic = async () => {
    try {
      const res = await fetch(`/api/diagnostic/team/${subdomain}`);
      const data = await res.json();
      setDiagnosticData(data);
      setShowDiagnostic(true);
      console.log('Diagnostic data:', data);
    } catch (error) {
      console.error('Diagnostic failed:', error);
    }
  };

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      
      if (!org?.id) {
        console.error('No org ID available');
        return;
      }
      
      const params = new URLSearchParams();
      params.set('orgId', org.id);
      params.set('filter', activeTab);
      if (searchQuery) params.set('q', searchQuery);

      console.log('Fetching tickets for org:', org.id, 'subdomain:', subdomain);
      
      const res = await fetch(`/api/tickets?${params.toString()}`);
      const data = await res.json();
      
      if (res.ok) {
        console.log('Tickets fetched:', data.tickets?.length || 0);
        setTickets(data.tickets || []);
      } else {
        console.error('Failed to fetch tickets:', data.error, res.status);
        setTickets([]);
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [org?.id, activeTab, searchQuery, subdomain]);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 30000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  const handleTicketClick = (ticket: TicketItem) => {
    openSlideOver('ticket', { ticketId: ticket.id });
  };

  const handleCreateTicket = () => {
    openSlideOver('ticket', { mode: 'create' });
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      P1: 'bg-red-500',
      P2: 'bg-orange-500',
      P3: 'bg-blue-500',
      P4: 'bg-stone-400',
    };
    return colors[priority] || 'bg-stone-400';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      NEW: 'text-amber-600 bg-amber-50',
      OPEN: 'text-orange-600 bg-orange-50',
      IN_PROGRESS: 'text-blue-600 bg-blue-50',
      WAITING_ON_CUSTOMER: 'text-purple-600 bg-purple-50',
      RESOLVED: 'text-emerald-600 bg-emerald-50',
      CLOSED: 'text-stone-600 bg-stone-50',
    };
    return colors[status] || 'text-stone-600 bg-stone-50';
  };

  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'all', label: 'All' },
    { id: 'mine', label: 'Mine' },
    { id: 'waiting', label: 'Waiting' },
    { id: 'resolved', label: 'Resolved' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <Inbox className="w-4 h-4 text-brand-500" />
          <h3 className="font-semibold text-stone-900">Tickets</h3>
          <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-xs font-medium rounded-full">
            {tickets.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runDiagnostic}
            className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            title="Run diagnostic"
          >
            <Bug className="w-4 h-4" />
          </button>
          <button
            onClick={handleCreateTicket}
            className="flex items-center gap-1 px-3 py-1.5 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>
      </div>

      {/* Diagnostic Panel */}
      {showDiagnostic && diagnosticData && (
        <div className="px-4 py-3 border-b border-stone-100 bg-amber-50">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm text-amber-900">Diagnostic Results</h4>
            <button
              onClick={() => setShowDiagnostic(false)}
              className="text-xs text-amber-700 hover:text-amber-900"
            >
              Hide
            </button>
          </div>
          <div className="text-xs space-y-1 text-amber-800">
            <p><strong>User:</strong> {diagnosticData.user?.email || 'Not logged in'}</p>
            <p><strong>Org:</strong> {diagnosticData.organization?.name || 'Not found'}</p>
            <p><strong>Membership:</strong> {diagnosticData.membership?.role || 'Not a member'}</p>
            <p><strong>Tickets found:</strong> {diagnosticData.ticketCount || 0}</p>
            {diagnosticData.allUserOrganizations?.length > 0 && (
              <div className="mt-2">
                <p className="font-medium">Your organizations:</p>
                <ul className="list-disc list-inside pl-2">
                  {diagnosticData.allUserOrganizations.map((o: any) => (
                    <li key={o.orgId}>{o.name} ({o.subdomain}) - {o.role}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-stone-100 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-stone-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all text-sm"
          />
        </div>
      </div>

      {/* Ticket List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <Ticket className="w-8 h-8 text-stone-300 mb-2" />
            <p className="text-sm text-stone-500">No tickets found</p>
            <button
              onClick={handleCreateTicket}
              className="mt-2 text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              Create your first ticket
            </button>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {tickets.map((ticket, index) => (
              <motion.button
                key={ticket.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleTicketClick(ticket)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors text-left group"
              >
                {/* Priority Indicator */}
                <div className={`w-1 h-10 rounded-full ${getPriorityColor(ticket.priority)}`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs text-stone-400">{ticket.key}</span>
                    {ticket.isUnread && (
                      <span className="w-2 h-2 bg-brand-500 rounded-full" />
                    )}
                  </div>
                  <p className="font-medium text-sm text-stone-900 truncate group-hover:text-brand-600 transition-colors">
                    {ticket.subject}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusColor(
                        ticket.status
                      )}`}
                    >
                      {ticket.status.replace(/_/g, ' ')}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-stone-400">
                      <Clock className="w-3 h-3" />
                      {new Date(ticket.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-2 text-stone-400">
                  {ticket.commentCount > 0 && (
                    <span className="flex items-center gap-1 text-xs">
                      <MessageSquare className="w-3 h-3" />
                      {ticket.commentCount}
                    </span>
                  )}
                  {ticket.attachmentCount > 0 && (
                    <span className="flex items-center gap-1 text-xs">
                      <Paperclip className="w-3 h-3" />
                      {ticket.attachmentCount}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
