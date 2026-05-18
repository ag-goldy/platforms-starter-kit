'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Organization } from '@/db/schema';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  Search,
  RefreshCw,
  MessageSquare,
  AlertCircle,
  Send,
  Paperclip,
  MoreHorizontal,
  ArrowLeft,
  Inbox,
  User,
  HardDrive,
  ChevronDown,
  ChevronRight,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils/date';
import { useToast } from '@/components/ui/toast';

interface LinkedAsset {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface Ticket {
  id: string;
  key: string;
  subject: string;
  status: 'NEW' | 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_CUSTOMER' | 'RESOLVED' | 'CLOSED';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  createdAt: string;
  updatedAt: string;
  description?: string;
  requester: { name: string | null; email: string } | null;
  assignee: { name: string | null; email: string } | null;
  comments: TicketComment[];
  unreadCount?: number;
  linkedAssets?: LinkedAsset[];
}

interface TicketComment {
  id: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
  user: { name: string | null; email: string } | null;
}

type TicketFilter = 'all' | 'mine' | 'waiting' | 'resolved';

interface TicketSplitViewProps {
  subdomain: string;
  initialTickets: Ticket[];
  org?: Organization;
}

export function TicketSplitView({ subdomain: _subdomain, initialTickets }: TicketSplitViewProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error } = useToast();
  
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    searchParams.get('ticket') || null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<TicketFilter>('all');

  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matches = 
        ticket.subject.toLowerCase().includes(query) ||
        ticket.key.toLowerCase().includes(query) ||
        ticket.description?.toLowerCase().includes(query);
      if (!matches) return false;
    }

    // Tab filter
    switch (activeFilter) {
      case 'waiting':
        return ticket.status === 'WAITING_ON_CUSTOMER';
      case 'resolved':
        return ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
      default:
        return true;
    }
  });

  // Handle ticket selection
  const handleSelectTicket = useCallback((ticketId: string) => {
    setSelectedTicketId(ticketId);
    // Update URL without navigation
    const url = new URL(window.location.href);
    url.searchParams.set('ticket', ticketId);
    window.history.pushState({}, '', url);
  }, []);

  // Handle back button (mobile)
  const handleBack = useCallback(() => {
    setSelectedTicketId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('ticket');
    window.history.pushState({}, '', url);
  }, []);

  // Send reply
  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyText, isInternal: false }),
      });

      if (!res.ok) throw new Error('Failed to send reply');

      const newComment = await res.json();
      
      // Update local state
      setTickets(prev => prev.map(t => 
        t.id === selectedTicket.id 
          ? { ...t, comments: [...t.comments, newComment], updatedAt: new Date().toISOString() }
          : t
      ));
      
      setReplyText('');
      success('Reply sent successfully');
    } catch {
      error('Failed to send reply');
    } finally {
      setIsSending(false);
    }
  };

  // AI Analysis
  const handleAIAnalysis = async () => {
    if (!selectedTicket) return;
    
    setIsAnalyzing(true);
    setShowAIAnalysis(true);
    
    try {
      const res = await fetch(`/api/ai/ticket-summary?ticketId=${selectedTicket.id}`);
      
      if (!res.ok) throw new Error('Failed to get AI analysis');
      
      const data = await res.json();
      setAiAnalysis(data.summary || 'No analysis available');
    } catch (err) {
      setAiAnalysis('Failed to generate analysis. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedTicketId) {
        handleBack();
      }
      
      // J/K navigation
      if (!selectedTicketId && filteredTickets.length > 0) {
        const currentIndex = filteredTickets.findIndex(t => t.id === selectedTicketId);
        
        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIndex = currentIndex < filteredTickets.length - 1 ? currentIndex + 1 : 0;
          handleSelectTicket(filteredTickets[nextIndex].id);
        }
        if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredTickets.length - 1;
          handleSelectTicket(filteredTickets[prevIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTicketId, filteredTickets, handleBack, handleSelectTicket]);

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col md:flex-row border rounded-xl overflow-hidden bg-white">
      {/* Left Panel - Ticket List */}
      <div className={cn(
        "w-full md:w-[400px] lg:w-[450px] flex flex-col border-r bg-gray-50/50",
        selectedTicketId && "hidden md:flex"
      )}>
        {/* Header */}
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Inbox className="w-5 h-5 text-gray-500" />
              Tickets
              <Badge variant="secondary" className="ml-1">
                {filteredTickets.length}
              </Badge>
            </h2>
            <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1">
            <FilterTab 
              label="All" 
              count={tickets.length} 
              active={activeFilter === 'all'} 
              onClick={() => setActiveFilter('all')} 
            />
            <FilterTab 
              label="Waiting" 
              count={tickets.filter(t => t.status === 'WAITING_ON_CUSTOMER').length} 
              active={activeFilter === 'waiting'} 
              onClick={() => setActiveFilter('waiting')} 
            />
            <FilterTab 
              label="Resolved" 
              count={tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length} 
              active={activeFilter === 'resolved'} 
              onClick={() => setActiveFilter('resolved')} 
            />
          </div>
        </div>

        {/* Ticket List */}
        <div className="flex-1 overflow-y-auto">
          {filteredTickets.length === 0 ? (
            <EmptyListState searchQuery={searchQuery} />
          ) : (
            <div className="divide-y">
              {filteredTickets.map((ticket) => (
                <TicketListItem
                  key={ticket.id}
                  ticket={ticket}
                  selected={selectedTicketId === ticket.id}
                  onClick={() => handleSelectTicket(ticket.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Conversation */}
      <div className={cn(
        "flex-1 flex flex-col bg-white",
        !selectedTicketId && "hidden md:flex"
      )}>
        {selectedTicket ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="md:hidden"
                  onClick={handleBack}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-gray-500">{selectedTicket.key}</span>
                    <StatusBadge status={selectedTicket.status} />
                    <PriorityBadge priority={selectedTicket.priority} />
                  </div>
                  <h3 className="font-semibold text-lg">{selectedTicket.subject}</h3>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAIAnalysis}
                  disabled={isAnalyzing}
                  className="hidden sm:flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  {isAnalyzing ? 'Analyzing...' : 'AI Analysis'}
                </Button>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Conversation Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Original Ticket Description */}
              <MessageBubble
                type="requester"
                author={selectedTicket.requester?.name || selectedTicket.requester?.email || 'Unknown'}
                timestamp={selectedTicket.createdAt}
                content={selectedTicket.description || 'No description provided'}
              />

              {/* Comments */}
              {selectedTicket.comments?.map((comment) => (
                <MessageBubble
                  key={comment.id}
                  type={comment.isInternal ? 'internal' : 'agent'}
                  author={comment.user?.name || comment.user?.email || 'Support Team'}
                  timestamp={comment.createdAt}
                  content={comment.content}
                />
              ))}

              {/* AI Analysis Panel */}
              {showAIAnalysis && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 my-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      <span className="font-medium text-purple-900">AI Analysis</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowAIAnalysis(false)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {isAnalyzing ? (
                    <div className="flex items-center gap-2 text-purple-700">
                      <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                      Analyzing ticket...
                    </div>
                  ) : (
                    <p className="text-sm text-purple-800 whitespace-pre-wrap">{aiAnalysis}</p>
                  )}
                </div>
              )}

              {/* Linked Assets Panel */}
              {selectedTicket.linkedAssets && selectedTicket.linkedAssets.length > 0 && (
                <div className="border rounded-lg overflow-hidden my-4">
                  <button
                    onClick={() => setShowAssets(!showAssets)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-sm">Linked Assets</span>
                      <Badge variant="secondary" className="text-xs">
                        {selectedTicket.linkedAssets.length}
                      </Badge>
                    </div>
                    {showAssets ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                  {showAssets && (
                    <div className="divide-y">
                      {selectedTicket.linkedAssets.map((asset) => (
                        <div key={asset.id} className="p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                            <HardDrive className="w-4 h-4 text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{asset.name}</p>
                            <p className="text-xs text-gray-500">{asset.type}</p>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              asset.status === 'ACTIVE' && "bg-green-50 text-green-700 border-green-200",
                              asset.status === 'DEGRADED' && "bg-yellow-50 text-yellow-700 border-yellow-200",
                              asset.status === 'OFFLINE' && "bg-red-50 text-red-700 border-red-200",
                            )}
                          >
                            {asset.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reply Box */}
            <div className="p-4 border-t bg-gray-50">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply... (Markdown supported)"
                    className="w-full p-3 pr-12 border rounded-lg resize-none min-h-[80px] focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.metaKey) {
                        handleSendReply();
                      }
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 bottom-2"
                    title="Attach file"
                  >
                    <Paperclip className="w-4 h-4 text-gray-400" />
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || isSending}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span>Cmd+Enter to send</span>
                <span>{replyText.length} characters</span>
              </div>
            </div>
          </>
        ) : (
          <EmptyConversationState />
        )}
      </div>
    </div>
  );
}

function FilterTab({ 
  label, 
  count, 
  active, 
  onClick 
}: { 
  label: string; 
  count: number; 
  active: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
        active 
          ? "bg-gray-900 text-white" 
          : "text-gray-600 hover:bg-gray-100"
      )}
    >
      {label}
      <span className={cn(
        "ml-1.5 text-xs",
        active ? "text-gray-300" : "text-gray-400"
      )}>
        {count}
      </span>
    </button>
  );
}

function TicketListItem({ 
  ticket, 
  selected, 
  onClick 
}: { 
  ticket: Ticket; 
  selected: boolean; 
  onClick: () => void;
}) {
  const statusColors: Record<string, string> = {
    NEW: 'bg-blue-500',
    OPEN: 'bg-orange-500',
    IN_PROGRESS: 'bg-yellow-500',
    WAITING_ON_CUSTOMER: 'bg-purple-500',
    RESOLVED: 'bg-green-500',
    CLOSED: 'bg-gray-400',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-4 text-left transition-colors hover:bg-gray-50",
        selected && "bg-orange-50 hover:bg-orange-50 border-l-4 border-orange-500"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("w-2 h-2 rounded-full mt-2 flex-shrink-0", statusColors[ticket.status])} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-gray-500">{ticket.key}</span>
            <PriorityBadge priority={ticket.priority} size="sm" />
          </div>
          <h4 className={cn(
            "font-medium truncate",
            selected ? "text-orange-900" : "text-gray-900"
          )}>
            {ticket.subject}
          </h4>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <span>{formatDateTime(ticket.updatedAt)}</span>
            {ticket.unreadCount ? (
              <Badge className="bg-orange-500 text-white text-[10px] px-1.5 py-0">
                {ticket.unreadCount}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ 
  type, 
  author, 
  timestamp, 
  content 
}: { 
  type: 'requester' | 'agent' | 'internal';
  author: string;
  timestamp: string;
  content: string;
}) {
  const styles = {
    requester: 'bg-gray-100 text-gray-900',
    agent: 'bg-orange-50 text-gray-900 border border-orange-100',
    internal: 'bg-yellow-50 text-gray-900 border border-yellow-200',
  };

  const icons = {
    requester: <User className="w-4 h-4" />,
    agent: <MessageSquare className="w-4 h-4 text-orange-500" />,
    internal: <AlertCircle className="w-4 h-4 text-yellow-600" />,
  };

  return (
    <div className={cn("flex gap-3", type === 'requester' ? 'flex-row' : 'flex-row-reverse')}>
      <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center flex-shrink-0">
        {icons[type]}
      </div>
      <div className={cn("max-w-[80%] rounded-2xl px-4 py-3", styles[type])}>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{author}</span>
          <span className="text-xs opacity-70">{formatDateTime(timestamp)}</span>
          {type === 'internal' && (
            <Badge variant="outline" className="text-[10px] h-4 border-yellow-400 text-yellow-700">
              Internal
            </Badge>
          )}
        </div>
        <div className="whitespace-pre-wrap text-sm">{content}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    NEW: { label: 'New', className: 'bg-blue-100 text-blue-800' },
    OPEN: { label: 'Open', className: 'bg-orange-100 text-orange-800' },
    IN_PROGRESS: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-800' },
    WAITING_ON_CUSTOMER: { label: 'Waiting', className: 'bg-purple-100 text-purple-800' },
    RESOLVED: { label: 'Resolved', className: 'bg-green-100 text-green-800' },
    CLOSED: { label: 'Closed', className: 'bg-gray-100 text-gray-800' },
  };

  const { label, className } = config[status] || config.NEW;

  return (
    <Badge className={cn("text-xs font-medium", className)}>
      {label}
    </Badge>
  );
}

function PriorityBadge({ priority, size = 'md' }: { priority: string; size?: 'sm' | 'md' }) {
  const config: Record<string, { label: string; className: string }> = {
    P1: { label: 'P1', className: 'bg-red-100 text-red-800 border-red-200' },
    P2: { label: 'P2', className: 'bg-orange-100 text-orange-800 border-orange-200' },
    P3: { label: 'P3', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    P4: { label: 'P4', className: 'bg-gray-100 text-gray-800 border-gray-200' },
  };

  const { label, className } = config[priority] || config.P3;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-mono font-semibold",
        size === 'sm' ? 'text-[10px] px-1 py-0' : 'text-xs',
        className
      )}
    >
      {label}
    </Badge>
  );
}

function EmptyListState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center p-4">
      <Inbox className="w-12 h-12 text-gray-300 mb-4" />
      <p className="text-gray-500 font-medium">
        {searchQuery ? 'No tickets match your search' : 'No tickets found'}
      </p>
      {searchQuery && (
        <p className="text-sm text-gray-400 mt-1">
          Try adjusting your search terms
        </p>
      )}
    </div>
  );
}

function EmptyConversationState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <MessageSquare className="w-10 h-10 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Select a ticket to view
      </h3>
      <p className="text-gray-500 max-w-sm">
        Choose a ticket from the list on the left to view the conversation and reply
      </p>
      <div className="mt-6 flex gap-2 text-sm text-gray-400">
        <kbd className="px-2 py-1 bg-gray-100 rounded">J</kbd>
        <span>Next ticket</span>
        <kbd className="px-2 py-1 bg-gray-100 rounded ml-2">K</kbd>
        <span>Previous ticket</span>
      </div>
    </div>
  );
}
