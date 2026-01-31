'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { closeCustomerTicketAction, updateCustomerTicketCcAction, addCustomerTicketCommentAction } from '@/app/s/[subdomain]/actions/tickets';
import { Ticket, Attachment, type TicketComment, Asset, Area, Site } from '@/db/schema';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { AttachmentList } from '@/components/tickets/attachment-list';
import { formatDateTime } from '@/lib/utils/date';
import { LinkedAssets } from '@/components/tickets/linked-assets';

interface CustomerTicketDetailProps {
  ticket: Ticket & {
    organization: { name: string };
    requestType?: { name: string } | null;
    site?: { name: string } | null;
    area?: { name: string } | null;
    requester: { name: string | null; email: string } | null;
    assignee: { name: string | null; email: string } | null;
    comments: (TicketComment & {
      user: { name: string | null; email: string } | null;
    })[];
    attachments: Attachment[];
    ticketAssets?: Array<{
      asset: Asset | null;
    }>;
  };
  availableAssets: Array<Asset & { site?: Site | null; area?: Area | null }>;
  canEditAssets: boolean;
}


const getStatusColor = (status: string) => {
  switch (status) {
    case 'NEW':
      return 'bg-blue-100 text-blue-800';
    case 'OPEN':
      return 'bg-green-100 text-green-800';
    case 'IN_PROGRESS':
      return 'bg-yellow-100 text-yellow-800';
    case 'RESOLVED':
      return 'bg-gray-100 text-gray-800';
    case 'CLOSED':
      return 'bg-gray-200 text-gray-900';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'P1':
      return 'bg-red-100 text-red-800';
    case 'P2':
      return 'bg-orange-100 text-orange-800';
    case 'P3':
      return 'bg-yellow-100 text-yellow-800';
    case 'P4':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

interface CustomerTicketDetailWithSubdomainProps extends CustomerTicketDetailProps {
  subdomain: string;
}

export function CustomerTicketDetail({
  ticket,
  subdomain,
  availableAssets,
  canEditAssets,
}: CustomerTicketDetailWithSubdomainProps) {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ccInput, setCcInput] = useState((ticket.ccEmails || []).join(', '));
  const [isUpdatingCc, setIsUpdatingCc] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  async function handleAddComment() {
    if (!comment.trim()) return;
    setIsSubmitting(true);
    try {
      await addCustomerTicketCommentAction(ticket.id, comment);
      setComment('');
      // Force a refresh to show the new comment
      window.location.reload();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateCc() {
    setIsUpdatingCc(true);
    try {
      const emails = ccInput
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.length > 0);
      await updateCustomerTicketCcAction(ticket.id, emails);
      // Force a refresh
      window.location.reload();
    } finally {
      setIsUpdatingCc(false);
    }
  }

  async function handleCloseTicket() {
    if (ticket.status === 'CLOSED') {
      return;
    }
    setIsClosing(true);
    try {
      await closeCustomerTicketAction(ticket.id);
      window.location.reload();
    } finally {
      setIsClosing(false);
    }
  }

  // Only show public comments to customers (filter out internal notes)
  const publicComments = ticket.comments.filter((c: { isInternal: boolean }) => !c.isInternal);
  const linkedAssets = (ticket.ticketAssets || [])
    .map((link) => {
      const asset = link.asset;
      if (!asset) return null;
      const fullAsset = availableAssets.find((candidate) => candidate.id === asset.id);
      return { asset: fullAsset || asset };
    })
    .filter((link): link is { asset: Asset & { site?: Site | null; area?: Area | null } } => !!link);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link 
            href={`/s/${subdomain}/tickets`}
            className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
          >
            ← Back to tickets
          </Link>
          <h1 className="text-2xl font-bold">{ticket.key}</h1>
        </div>
        <div className="flex gap-2">
          <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
          <Badge className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
          {ticket.status !== 'CLOSED' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCloseTicket}
              disabled={isClosing}
            >
              {isClosing ? 'Closing...' : 'Close ticket'}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{ticket.subject}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-gray-500">Description</Label>
            <p className="mt-1 whitespace-pre-wrap">{ticket.description}</p>
          </div>

          <Separator />

          <div>
            <Label className="text-xs text-gray-500">Attachments</Label>
            <div className="mt-2">
              <AttachmentList attachments={ticket.attachments} />
            </div>
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <p>
              <strong>Status:</strong> {ticket.status}
            </p>
            <p>
              <strong>Priority:</strong> {ticket.priority}
            </p>
            <div className="py-2">
              <Label htmlFor="cc-emails" className="text-xs text-gray-500 block mb-1">
                CC Emails (comma separated)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="cc-emails"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  placeholder="email@example.com, another@example.com"
                  className="h-8 text-sm"
                />
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleUpdateCc}
                  disabled={isUpdatingCc || ccInput === (ticket.ccEmails || []).join(', ')}
                >
                  {isUpdatingCc ? 'Saving...' : 'Update'}
                </Button>
              </div>
            </div>
            {ticket.requestType && (
              <p>
                <strong>Request Type:</strong> {ticket.requestType.name}
              </p>
            )}
            {ticket.site && (
              <p>
                <strong>Site:</strong> {ticket.site.name}
              </p>
            )}
            {ticket.area && (
              <p>
                <strong>Area:</strong> {ticket.area.name}
              </p>
            )}
            {ticket.assignee && (
              <p>
                <strong>Assigned to:</strong> {ticket.assignee.name || ticket.assignee.email}
              </p>
            )}
            <p>
              <strong>Created:</strong> {formatDateTime(ticket.createdAt)}
            </p>
          </div>
        </CardContent>
      </Card>

      <LinkedAssets
        ticketId={ticket.id}
        linkedAssets={linkedAssets}
        availableAssets={availableAssets}
        canEdit={canEditAssets}
        scope="customer"
      />

      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {publicComments.map((comment: TicketComment & { user?: { name: string | null; email: string } | null; authorEmail?: string | null }) => (
            <div key={comment.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <strong className="text-sm">
                    {comment.user?.name || comment.user?.email || 'Support Team'}
                  </strong>
                  <span className="text-xs text-gray-500">
                    {formatDateTime(comment.createdAt)}
                  </span>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded-md">
                {comment.content}
              </p>
              <Separator />
            </div>
          ))}

          {publicComments.length === 0 && (
            <p className="text-sm text-gray-500">No replies yet.</p>
          )}

          <div className="space-y-4 border-t pt-4">
            <Label htmlFor="comment">Add a Reply</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Type your reply..."
              rows={4}
            />
            <Button
              onClick={handleAddComment}
              disabled={!comment.trim() || isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Reply'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
