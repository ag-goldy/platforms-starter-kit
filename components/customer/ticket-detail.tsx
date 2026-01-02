'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { addCustomerTicketCommentAction } from '@/app/s/[subdomain]/actions/tickets';
import { Ticket } from '@/db/schema';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

interface CustomerTicketDetailProps {
  ticket: Ticket & {
    organization: { name: string };
    requester: { name: string | null; email: string } | null;
    assignee: { name: string | null; email: string } | null;
    comments: (TicketComment & {
      user: { name: string | null; email: string } | null;
    })[];
  };
}

type TicketComment = {
  id: string;
  content: string;
  isInternal: boolean;
  createdAt: Date;
  user: { name: string | null; email: string } | null;
};

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

export function CustomerTicketDetail({ ticket, subdomain }: CustomerTicketDetailWithSubdomainProps) {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Only show public comments to customers (filter out internal notes)
  const publicComments = ticket.comments.filter((c) => !c.isInternal);

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

          <div className="text-sm text-gray-600 space-y-1">
            <p>
              <strong>Status:</strong> {ticket.status}
            </p>
            <p>
              <strong>Priority:</strong> {ticket.priority}
            </p>
            {ticket.assignee && (
              <p>
                <strong>Assigned to:</strong> {ticket.assignee.name || ticket.assignee.email}
              </p>
            )}
            <p>
              <strong>Created:</strong> {new Date(ticket.createdAt).toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {publicComments.map((comment) => (
            <div key={comment.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <strong className="text-sm">
                    {comment.user?.name || comment.user?.email || 'Support Team'}
                  </strong>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.createdAt).toLocaleString()}
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

