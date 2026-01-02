'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  updateTicketStatusAction,
  assignTicketAction,
  updateTicketPriorityAction,
  addTicketCommentAction,
} from '@/app/app/actions/tickets';
import { Ticket } from '@/db/schema';
import { Separator } from '@/components/ui/separator';

interface TicketDetailProps {
  ticket: Ticket & {
    organization: { name: string };
    requester: { name: string | null; email: string } | null;
    assignee: { name: string | null; email: string } | null;
    comments: (TicketComment & {
      user: { name: string | null; email: string } | null;
    })[];
  };
  internalUsers: { id: string; name: string | null; email: string }[];
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

export function TicketDetail({ ticket, internalUsers }: TicketDetailProps) {
  const router = useRouter();
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleStatusChange(status: string) {
    await updateTicketStatusAction(ticket.id, status);
    router.refresh();
  }

  async function handlePriorityChange(priority: string) {
    await updateTicketPriorityAction(ticket.id, priority);
    router.refresh();
  }

  async function handleAssigneeChange(assigneeId: string) {
    const value = assigneeId === 'unassigned' ? null : assigneeId;
    await assignTicketAction(ticket.id, value);
    router.refresh();
  }

  async function handleAddComment() {
    if (!comment.trim()) return;
    setIsSubmitting(true);
    try {
      await addTicketCommentAction(ticket.id, comment, isInternal);
      setComment('');
      setIsInternal(false);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  const publicComments = ticket.comments.filter((c) => !c.isInternal);
  const internalComments = ticket.comments.filter((c) => c.isInternal);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{ticket.key}</h1>
          <p className="mt-1 text-gray-600">{ticket.organization.name}</p>
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="status" className="text-xs text-gray-500">
                Status
              </Label>
              <Select
                value={ticket.status}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger id="status" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="WAITING_ON_CUSTOMER">Waiting on Customer</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority" className="text-xs text-gray-500">
                Priority
              </Label>
              <Select
                value={ticket.priority}
                onValueChange={handlePriorityChange}
              >
                <SelectTrigger id="priority" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="P1">P1 - Critical</SelectItem>
                  <SelectItem value="P2">P2 - High</SelectItem>
                  <SelectItem value="P3">P3 - Medium</SelectItem>
                  <SelectItem value="P4">P4 - Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="assignee" className="text-xs text-gray-500">
                Assignee
              </Label>
              <Select
                value={ticket.assigneeId || 'unassigned'}
                onValueChange={handleAssigneeChange}
              >
                <SelectTrigger id="assignee" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {internalUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            <p>
              <strong>Requester:</strong>{' '}
              {ticket.requester?.name || ticket.requester?.email || 'Unknown'}
            </p>
            {ticket.assignee && (
              <p>
                <strong>Assigned to:</strong>{' '}
                {ticket.assignee.name || ticket.assignee.email}
              </p>
            )}
            <p>
              <strong>Created:</strong>{' '}
              {new Date(ticket.createdAt).toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {publicComments.map((comment) => (
            <div key={comment.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <strong className="text-sm">
                    {comment.user?.name || comment.user?.email || 'Unknown'}
                  </strong>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
              <Separator />
            </div>
          ))}

          {publicComments.length === 0 && (
            <p className="text-sm text-gray-500">No public comments yet.</p>
          )}

          <div className="space-y-4 border-t pt-4">
            <Label htmlFor="comment">Add Comment</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
              rows={4}
            />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Internal note (not visible to customer)
              </label>
              <Button
                onClick={handleAddComment}
                disabled={!comment.trim() || isSubmitting}
              >
                {isSubmitting ? 'Adding...' : 'Add Comment'}
              </Button>
            </div>
          </div>

          {internalComments.length > 0 && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-sm text-gray-700">Internal Notes</h3>
              {internalComments.map((comment) => (
                <div key={comment.id} className="space-y-2 rounded-md bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm">
                        {comment.user?.name || comment.user?.email || 'Unknown'}
                      </strong>
                      <span className="text-xs text-gray-500">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
