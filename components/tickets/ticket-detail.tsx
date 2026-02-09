'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MentionInput } from '@/components/mentions/mention-input';
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
  addTicketAttachmentAction,
} from '@/app/app/actions/tickets';
import { getTemplatesAction } from '@/app/app/actions/templates';
import { Ticket, Attachment, Asset, Area, Site } from '@/db/schema';
import { Separator } from '@/components/ui/separator';
import { AttachmentList } from '@/components/tickets/attachment-list';
import { MergeTicketDialog } from './merge-ticket-dialog';
import { TicketTags } from './ticket-tags';
import { formatDateTime } from '@/lib/utils/date';
import { useToast } from '@/components/ui/toast';
import { formatErrorMessage } from '@/lib/utils/errors';
import { FormError } from '@/components/ui/form-error';
import { TicketShortcuts } from './ticket-shortcuts';
import { SLAIndicator } from './sla-indicator';
import { TicketUpdateNotification } from './ticket-update-notification';
import { CannedResponsePicker } from './canned-response-picker';
import { TicketLinks } from './ticket-links';
import { LinkedAssets } from '@/components/tickets/linked-assets';
import { TicketWatchers } from './ticket-watchers';
import type { SLAMetrics } from '@/lib/tickets/sla';

interface TicketDetailProps {
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
  internalUsers: { id: string; name: string | null; email: string }[];
  slaMetrics?: SLAMetrics | null;
  availableAssets: Array<Asset & { site?: Site | null; area?: Area | null }>;
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

export function TicketDetail({ ticket, internalUsers, slaMetrics, availableAssets }: TicketDetailProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; content: string }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const loadedTemplates = await getTemplatesAction();
        setTemplates(loadedTemplates);
      } catch (error) {
        console.error('Failed to load templates:', error);
      }
    }
    loadTemplates();
  }, []);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      // Replace placeholders with actual values
      let content = template.content;
      content = content.replace(/\{\{ticket\.subject\}\}/g, ticket.subject);
      content = content.replace(/\{\{requester\.name\}\}/g, ticket.requester?.name || ticket.requester?.email || 'Customer');
      content = content.replace(/\{\{requester\.email\}\}/g, ticket.requester?.email || '');
      setComment(content);
    }
  };

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
      showToast('Comment added successfully', 'success');
      router.refresh();
    } catch (err) {
      const errorMessage = formatErrorMessage(err);
      showToast(errorMessage, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAttachmentUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = fileInputRef.current;
    if (!input || !input.files || input.files.length === 0) {
      setAttachmentError('Please choose a file to upload.');
      return;
    }

    setIsUploading(true);
    setAttachmentError(null);

    try {
      const formData = new FormData();
      formData.append('ticketId', ticket.id);
      Array.from(input.files).forEach((file) => {
        formData.append('attachments', file);
      });
      await addTicketAttachmentAction(formData);
      input.value = '';
      showToast('Attachment uploaded successfully', 'success');
      router.refresh();
    } catch (err) {
      const errorMessage = formatErrorMessage(err);
      setAttachmentError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsUploading(false);
    }
  }

  const publicComments = ticket.comments.filter((c: { isInternal: boolean }) => !c.isInternal);
  const internalComments = ticket.comments.filter((c: { isInternal: boolean }) => c.isInternal);
  const linkedAssets = (ticket.ticketAssets || [])
    .map((link) => {
      const asset = link.asset;
      if (!asset) return null;
      const fullAsset = availableAssets.find((candidate) => candidate.id === asset.id);
      return { asset: fullAsset || asset };
    })
    .filter((link): link is { asset: Asset & { site?: Site | null; area?: Area | null } } => !!link);

  return (
    <div className="space-y-4 md:space-y-6">
      <TicketUpdateNotification
        ticketId={ticket.id}
        currentUpdatedAt={ticket.updatedAt}
        currentCommentCount={ticket.comments.length}
      />
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{ticket.key}</h1>
          <p className="mt-1 text-gray-600">{ticket.organization.name}</p>
          {ticket.mergedIntoId && (
            <p className="mt-1 text-sm text-orange-600">
              This ticket has been merged into another ticket.
            </p>
          )}
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-2">
          <div className="flex flex-wrap gap-2">
            <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
            <Badge className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TicketWatchers ticketId={ticket.id} />
            {slaMetrics && <SLAIndicator metrics={slaMetrics} showDetails={true} />}
            {!ticket.mergedIntoId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMergeDialog(true)}
                className="text-red-600 hover:text-red-700"
              >
                Merge Ticket
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const win = window as Window & { __openShortcutsHelp?: () => void };
                if (win.__openShortcutsHelp) {
                  win.__openShortcutsHelp();
                }
              }}
              title="Keyboard Shortcuts (⌘?)"
              className="text-xs"
            >
              ⌘?
            </Button>
          </div>
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
                <strong>Assigned to:</strong>{' '}
                {ticket.assignee.name || ticket.assignee.email}
              </p>
            )}
            <p>
              <strong>Created:</strong> {formatDateTime(ticket.createdAt)}
            </p>
          </div>

          <div className="border-t pt-4">
            <Label className="text-xs text-gray-500 mb-2 block">Tags</Label>
            <TicketTags ticketId={ticket.id} />
          </div>
        </CardContent>
      </Card>

      <LinkedAssets
        ticketId={ticket.id}
        linkedAssets={linkedAssets}
        availableAssets={availableAssets}
        canEdit
        scope="internal"
      />

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {publicComments.map((comment: { id: string; content: string; isInternal: boolean; createdAt: Date; user?: { name: string | null; email: string } | null; authorEmail?: string | null }) => (
            <div key={comment.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <strong className="text-sm">
                    {comment.user?.name || comment.user?.email || 'Unknown'}
                  </strong>
                  <span className="text-xs text-gray-500">
                    {formatDateTime(comment.createdAt)}
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
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label htmlFor="comment">Add Comment</Label>
              <div className="flex items-center gap-2">
                <CannedResponsePicker
                  orgId={ticket.orgId}
                  onSelect={(content) => setComment(content)}
                  className="w-48"
                />
                {templates.length > 0 && (
                  <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Use template..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No template</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <MentionInput
              orgId={ticket.orgId}
              value={comment}
              onChange={setComment}
              placeholder="Add a comment... Use @ to mention someone"
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
              {internalComments.map((comment: { id: string; content: string; isInternal: boolean; createdAt: Date; user?: { name: string | null; email: string } | null; authorEmail?: string | null }) => (
                <div key={comment.id} className="space-y-2 rounded-md bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm">
                        {comment.user?.name || comment.user?.email || 'Unknown'}
                      </strong>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(comment.createdAt)}
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

      <TicketLinks ticketId={ticket.id} ticketKey={ticket.key} />

      <Card>
        <CardHeader>
          <CardTitle>Attachments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AttachmentList attachments={ticket.attachments} />

          <form onSubmit={handleAttachmentUpload} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="attachments">Upload files</Label>
              <input
                ref={fileInputRef}
                id="attachments"
                name="attachments"
                type="file"
                multiple
                className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
              />
            </div>

            <FormError error={attachmentError} />

            <Button type="submit" disabled={isUploading}>
              {isUploading ? 'Uploading...' : 'Upload Attachment'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {showMergeDialog && (
        <MergeTicketDialog
          ticketId={ticket.id}
          ticketKey={ticket.key}
          onClose={() => setShowMergeDialog(false)}
        />
      )}

      <TicketShortcuts
        ticketId={ticket.id}
        currentStatus={ticket.status}
        currentPriority={ticket.priority}
        onStatusChange={handleStatusChange}
        onPriorityChange={handlePriorityChange}
      />
    </div>
  );
}
