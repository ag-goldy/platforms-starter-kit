'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ticket,
  Clock,
  MessageSquare,
  Paperclip,
  Send,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  User,
  Tag,
  AlertCircle,
  ChevronDown,
  Link as LinkIcon,
  AlertTriangle,
  Copy,
  Check,
  Server,
  Plus,
  Unlink,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { AssetSelector } from './AssetSelector';

interface TicketSlideOverProps {
  data: {
    ticketId?: string;
    mode?: 'view' | 'create';
  } | null;
  onClose: () => void;
}

interface Asset {
  id: string;
  name: string;
  type: string;
  hostname?: string;
  ipAddress?: string;
  status: string;
  zabbixHostId?: string;
  isZabbixSynced: boolean;
  linkedAt?: string;
}

interface TicketData {
  id: string;
  key: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  description: string;
  createdAt: string;
  requester: {
    name: string;
    email: string;
  };
  assignee?: {
    name: string;
  };
  comments: Comment[];
  attachments: Attachment[];
  assets?: Asset[];
  orgId?: string;
}

interface Comment {
  id: string;
  author: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

interface Attachment {
  id: string;
  name: string;
  size: number;
  url: string;
}

export function TicketSlideOver({ data, onClose }: TicketSlideOverProps) {
  const params = useParams();
  const subdomain = params?.subdomain as string;
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [isCreating, setIsCreating] = useState(data?.mode === 'create');
  const [newTicketForm, setNewTicketForm] = useState({
    subject: '',
    description: '',
    priority: 'P3',
    category: 'INCIDENT',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkedAssets, setLinkedAssets] = useState<Asset[]>([]);
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data?.ticketId && !isCreating) {
      fetchTicket(data.ticketId);
    } else {
      setLoading(false);
    }
  }, [data?.ticketId, isCreating]);

  // Scroll to bottom of comments
  useEffect(() => {
    if (ticket?.comments) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [ticket?.comments]);

  const fetchTicket = async (ticketId: string) => {
    setLoading(true);
    try {
      console.log('Fetching ticket:', ticketId);
      const res = await fetch(`/api/tickets/${ticketId}`);
      const data = await res.json();
      
      if (res.ok) {
        console.log('Ticket fetched successfully:', data.key);
        setTicket(data);
        // Also fetch linked assets
        fetchLinkedAssets(ticketId);
      } else {
        console.error('Failed to fetch ticket:', data.error, res.status);
        setTicket(null);
      }
    } catch (error) {
      console.error('Failed to fetch ticket:', error);
      setTicket(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchLinkedAssets = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/assets`);
      if (res.ok) {
        const data = await res.json();
        setLinkedAssets(data.assets || []);
      }
    } catch (error) {
      console.error('Failed to fetch linked assets:', error);
    }
  };

  const handleLinkAsset = async (asset: Asset) => {
    if (!ticket) return;
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset.id }),
      });
      if (res.ok) {
        setLinkedAssets((prev) => [...prev, asset]);
      }
    } catch (error) {
      console.error('Failed to link asset:', error);
    }
  };

  const handleUnlinkAsset = async (assetId: string) => {
    if (!ticket) return;
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/assets?assetId=${assetId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setLinkedAssets((prev) => prev.filter((a) => a.id !== assetId));
      }
    } catch (error) {
      console.error('Failed to unlink asset:', error);
    }
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim() || !ticket) return;

    // Optimistic update
    const newComment: Comment = {
      id: 'temp-' + Date.now(),
      author: 'You',
      content: replyText,
      isInternal: false,
      createdAt: new Date().toISOString(),
    };

    setTicket((prev) =>
      prev
        ? {
            ...prev,
            comments: [...prev.comments, newComment],
          }
        : null
    );
    setReplyText('');

    // Actual API call
    try {
      await fetch(`/api/tickets/${ticket.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyText }),
      });
    } catch (error) {
      console.error('Failed to submit reply:', error);
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicketForm.subject.trim() || !newTicketForm.description.trim()) return;

    try {
      const res = await fetch(`/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicketForm),
      });

      if (res.ok) {
        const created = await res.json();
        setIsCreating(false);
        fetchTicket(created.id);
      }
    } catch (error) {
      console.error('Failed to create ticket:', error);
    }
  };

  const handleResolveTicket = async () => {
    if (!ticket) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RESOLVED' }),
      });

      if (res.ok) {
        fetchTicket(ticket.id);
      }
    } catch (error) {
      console.error('Failed to resolve ticket:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEscalateTicket = async () => {
    if (!ticket) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          reason: 'Customer escalated',
        }),
      });

      if (res.ok) {
        fetchTicket(ticket.id);
      }
    } catch (error) {
      console.error('Failed to escalate ticket:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyLink = () => {
    if (!ticket) return;
    const url = `${window.location.origin}/s/${subdomain}/tickets/${ticket.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      NEW: 'bg-amber-500',
      OPEN: 'bg-orange-500',
      IN_PROGRESS: 'bg-blue-500',
      WAITING_ON_CUSTOMER: 'bg-purple-500',
      RESOLVED: 'bg-emerald-500',
      CLOSED: 'bg-stone-400',
    };
    return colors[status] || 'bg-stone-400';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      P1: 'text-red-600 bg-red-50',
      P2: 'text-orange-600 bg-orange-50',
      P3: 'text-blue-600 bg-blue-50',
      P4: 'text-stone-600 bg-stone-50',
    };
    return colors[priority] || colors.P3;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isCreating) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100">
          <h2 className="text-lg font-semibold text-stone-900">Create New Ticket</h2>
          <p className="text-sm text-stone-500">Submit a new support request</p>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Subject</label>
            <input
              type="text"
              value={newTicketForm.subject}
              onChange={(e) =>
                setNewTicketForm((prev) => ({ ...prev, subject: e.target.value }))
              }
              placeholder="Brief summary of your issue"
              className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">Priority</label>
              <select
                value={newTicketForm.priority}
                onChange={(e) =>
                  setNewTicketForm((prev) => ({ ...prev, priority: e.target.value }))
                }
                className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
              >
                <option value="P1">P1 - Critical</option>
                <option value="P2">P2 - High</option>
                <option value="P3">P3 - Normal</option>
                <option value="P4">P4 - Low</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">Category</label>
              <select
                value={newTicketForm.category}
                onChange={(e) =>
                  setNewTicketForm((prev) => ({ ...prev, category: e.target.value }))
                }
                className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
              >
                <option value="INCIDENT">Incident</option>
                <option value="SERVICE_REQUEST">Service Request</option>
                <option value="CHANGE_REQUEST">Change Request</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Description</label>
            <textarea
              value={newTicketForm.description}
              onChange={(e) =>
                setNewTicketForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Provide detailed information about your issue..."
              rows={8}
              className="w-full px-4 py-3 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-between">
          <button
            onClick={() => setIsCreating(false)}
            className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateTicket}
            disabled={!newTicketForm.subject.trim() || !newTicketForm.description.trim()}
            className="px-6 py-2 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Create Ticket
          </button>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <Ticket className="w-12 h-12 text-stone-300 mb-4" />
        <h3 className="text-lg font-medium text-stone-900 mb-1">Ticket not found</h3>
        <p className="text-sm text-stone-500">The ticket you're looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-100">
        <div className="flex items-start justify-between pr-12">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-sm text-stone-500">{ticket.key}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(
                  ticket.priority
                )}`}
              >
                {ticket.priority}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-stone-900">{ticket.subject}</h2>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${getStatusColor(ticket.status)}`} />
            <span className="text-sm font-medium text-stone-700">
              {ticket.status.replace(/_/g, ' ')}
            </span>
          </div>
          <span className="text-stone-300">|</span>
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <Clock className="w-4 h-4" />
            {new Date(ticket.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Conversation Thread (70%) */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-stone-100">
          {/* Description */}
          <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/50">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-brand-700">
                  {ticket.requester.name[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-stone-900">
                    {ticket.requester.name}
                  </span>
                  <span className="text-xs text-stone-400">
                    {new Date(ticket.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-stone-700 whitespace-pre-wrap">{ticket.description}</p>
              </div>
            </div>
          </div>

          {/* Comments */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {ticket.comments
              .filter((c) => !c.isInternal)
              .map((comment, index) => (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-stone-600">
                      {comment.author[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-stone-900">{comment.author}</span>
                      <span className="text-xs text-stone-400">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-stone-700 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                </motion.div>
              ))}
            <div ref={commentsEndRef} />
          </div>

          {/* Reply Box */}
          <div className="px-6 py-4 border-t border-stone-100">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleSubmitReply();
                    }
                  }}
                  placeholder="Write a reply... (Cmd+Enter to send)"
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all resize-none"
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  <button className="p-1.5 text-stone-400 hover:text-stone-600 transition-colors">
                    <Paperclip className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <button
                onClick={handleSubmitReply}
                disabled={!replyText.trim()}
                className="px-4 py-3 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Context Sidebar (30%) */}
        <div className="w-72 bg-stone-50/50 overflow-y-auto">
          {/* Assignee */}
          <div className="p-4 border-b border-stone-100">
            <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
              Assignee
            </h4>
            {ticket.assignee ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                  <span className="text-xs font-semibold text-brand-700">
                    {ticket.assignee.name[0]}
                  </span>
                </div>
                <span className="text-sm font-medium text-stone-900">{ticket.assignee.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-stone-500">
                <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <span className="text-sm">Unassigned</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="p-4 border-b border-stone-100">
            <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
              Details
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">Category</span>
                <span className="font-medium text-stone-900">{ticket.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Created</span>
                <span className="text-stone-700">
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Attachments */}
          {ticket.attachments.length > 0 && (
            <div className="p-4 border-b border-stone-100">
              <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
                Attachments ({ticket.attachments.length})
              </h4>
              <div className="space-y-2">
                {ticket.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-lg bg-white border border-stone-200 hover:border-brand-300 transition-colors"
                  >
                    <Paperclip className="w-4 h-4 text-stone-400" />
                    <span className="flex-1 text-sm text-stone-700 truncate">
                      {attachment.name}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Linked Assets */}
          <div className="p-4 border-b border-stone-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                Linked Assets
              </h4>
              <button
                onClick={() => setShowAssetSelector(true)}
                className="p-1 text-stone-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                title="Link asset"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {linkedAssets.length === 0 ? (
              <p className="text-sm text-stone-400">No assets linked</p>
            ) : (
              <div className="space-y-2">
                {linkedAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-white border border-stone-200"
                  >
                    <Server className="w-4 h-4 text-stone-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-900 truncate">
                        {asset.name}
                      </p>
                      <p className="text-xs text-stone-500">
                        {asset.type} {asset.isZabbixSynced && '• Zabbix'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleUnlinkAsset(asset.id)}
                      className="p-1 text-stone-400 hover:text-red-600 transition-colors"
                      title="Unlink"
                    >
                      <Unlink className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4">
            <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
              Actions
            </h4>
            <div className="space-y-2">
              {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
                <button
                  onClick={handleResolveTicket}
                  disabled={isUpdating}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-stone-700 hover:bg-white hover:shadow-sm transition-all disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  {isUpdating ? 'Updating...' : 'Mark as Resolved'}
                </button>
              )}
              {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
                <button
                  onClick={handleEscalateTicket}
                  disabled={isUpdating}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-stone-700 hover:bg-white hover:shadow-sm transition-all disabled:opacity-50"
                >
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  {isUpdating ? 'Updating...' : 'Escalate Ticket'}
                </button>
              )}
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-stone-700 hover:bg-white hover:shadow-sm transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-4 h-4 text-blue-500" />
                    Copy Link
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Asset Selector Modal */}
          <AnimatePresence>
            {showAssetSelector && ticket && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/20 z-50"
                  onClick={() => setShowAssetSelector(false)}
                />
                <motion.div
                  initial={{ opacity: 0, x: '100%' }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: '100%' }}
                  transition={{ type: 'spring', damping: 25 }}
                  className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white shadow-2xl z-50"
                >
                  <AssetSelector
                    orgId={ticket.orgId || ''}
                    subdomain={subdomain}
                    linkedAssets={linkedAssets}
                    onLink={handleLinkAsset}
                    onUnlink={handleUnlinkAsset}
                    onClose={() => setShowAssetSelector(false)}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
