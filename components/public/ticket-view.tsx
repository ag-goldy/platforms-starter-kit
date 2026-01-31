'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { addPublicTicketCommentAction } from '@/app/ticket/[token]/actions';
import { Ticket, Attachment } from '@/db/schema';
import { Separator } from '@/components/ui/separator';
import { AttachmentList } from '@/components/tickets/attachment-list';
import { useRouter } from 'next/navigation';
import { formatDateTime } from '@/lib/utils/date';

interface PublicTicketViewProps {
  ticket: Ticket & {
    organization: { name: string };
    requester: { name: string | null; email: string } | null;
    assignee: { name: string | null; email: string } | null;
    comments: (TicketComment & {
      user: { name: string | null; email: string } | null;
    })[];
    attachments: Attachment[];
  };
  replyToken: string;
  viewToken: string;
  downloadTokens: Record<string, string>;
}

type TicketComment = {
  id: string;
  content: string;
  isInternal: boolean;
  createdAt: Date;
  user: { name: string | null; email: string } | null;
  authorEmail: string | null;
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

export function PublicTicketView({
  ticket,
  replyToken,
  viewToken,
  downloadTokens,
}: PublicTicketViewProps) {
  const router = useRouter();
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentReplyToken, setCurrentReplyToken] = useState(replyToken);

  useEffect(() => {
    if (!viewToken) return;
    const nextUrl = `/ticket/${viewToken}`;
    if (window.location.pathname !== nextUrl) {
      window.history.replaceState({}, '', nextUrl);
    }
  }, [viewToken]);

  async function handleAddComment() {
    if (!comment.trim()) return;
    setIsSubmitting(true);
    try {
      const result = await addPublicTicketCommentAction(
        currentReplyToken,
        comment
      );
      setComment('');
      if (result?.replyToken) {
        setCurrentReplyToken(result.replyToken);
      }
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  // Only show public comments (filter out internal notes)
  const publicComments = ticket.comments.filter((c: { isInternal: boolean }) => !c.isInternal);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{ticket.key}</h1>
          <p className="mt-1 text-sm text-gray-600">
            Secure ticket access - you can view and reply to this ticket
          </p>
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

          <div>
            <Label className="text-xs text-gray-500">Attachments</Label>
            <div className="mt-2">
              <AttachmentList
                attachments={ticket.attachments}
                downloadTokens={downloadTokens}
              />
            </div>
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
              <strong>Created:</strong> {formatDateTime(ticket.createdAt)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {publicComments.map((comment: { id: string; content: string; isInternal: boolean; createdAt: Date; user?: { name: string | null; email: string } | null; authorEmail?: string | null }) => (
            <div key={comment.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <strong className="text-sm">
                    {comment.user?.name ||
                      comment.authorEmail ||
                      comment.user?.email ||
                      'Support Team'}
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

