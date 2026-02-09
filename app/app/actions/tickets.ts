'use server';

import { db } from '@/db';
import { attachments, tickets, ticketComments, organizations, sites, areas, type Ticket } from '@/db/schema';
import { requireInternalRole, canViewTicket } from '@/lib/auth/permissions';
import { generateTicketKey } from '@/lib/tickets/keys';
import { logAudit } from '@/lib/audit/log';
import {
  sendAgentReplyNotification,
  sendTicketStatusChangedNotification,
  sendAdminCreatedTicketNotification,
} from '@/lib/email/notifications';
import { getTicketById } from '@/lib/tickets/queries';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import { put } from '@vercel/blob';
import { validateAttachmentFile } from '@/lib/attachments/validation';
import { appBaseUrl } from '@/lib/utils';
import { getOrgSLATargets, updateFirstResponseTime, updateResolutionTime } from '@/lib/tickets/sla';
import { updateSLAPauseStatus } from '@/lib/tickets/sla-pause';
import { checkQuota, incrementStorageUsage } from '@/lib/attachments/quota';
import { enqueueJob } from '@/lib/jobs/queue';
import { triggerOnTicketCreate, triggerOnTicketUpdate } from '@/lib/automation/rules';
import { processMentions } from '@/lib/mentions';

const ticketStatusSchema = z.enum(['NEW', 'OPEN', 'WAITING_ON_CUSTOMER', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
const ticketPrioritySchema = z.enum(['P1', 'P2', 'P3', 'P4']);
const ticketCategorySchema = z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE_REQUEST']);
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

async function uploadAttachment(ticketId: string, file: File) {
  if (!blobToken) {
    throw new Error('Blob storage is not configured');
  }

  const validated = validateAttachmentFile(file);
  const safeName = validated.filename;
  const path = `tickets/${ticketId}/${crypto.randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  // Note: In @vercel/blob 0.24+, blobs are private by default
  // We use signed URLs for secure access, so files don't need to be public
  const blob = await put(path, buffer, {
    contentType: validated.contentType,
    token: blobToken,
    // Explicitly set access to 'public' if required by SDK version
    // Files are still secured via signed URLs in the download route
    access: 'public' as const,
  });

  return {
    filename: safeName,
    contentType: validated.contentType,
    size: validated.size,
    blobPathname: blob.pathname,
    // For public blobs, store the URL directly; for private, store pathname
    storageKey: blob.url || blob.pathname,
  };
}

export async function updateTicketStatusAction(
  ticketId: string,
  status: string
) {
  const user = await requireInternalRole();
  const result = await canViewTicket(ticketId);
  
  const validatedStatus = ticketStatusSchema.parse(status);
  const oldStatus = result.ticket.status;

  if (validatedStatus === oldStatus) {
    return;
  }

  await db
    .update(tickets)
    .set({ status: validatedStatus, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));

  // Update resolution time if ticket is being resolved/closed
  await updateResolutionTime(ticketId, validatedStatus);

  // Trigger automation rules for ticket update
  const updatedTicket = await getTicketById(ticketId, result.ticket.orgId);
  if (updatedTicket) {
    await triggerOnTicketUpdate(updatedTicket, user.id);
  }

  // Update SLA pause status based on new status
  // Get organization's business hours config
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, result.ticket.orgId),
    columns: {
      businessHours: true,
    },
  });

  let businessHoursConfig = null;
  if (org?.businessHours) {
    // businessHours is already parsed by Drizzle's $type
    businessHoursConfig = org.businessHours;
  }

  await updateSLAPauseStatus(ticketId, validatedStatus, businessHoursConfig);

  await logAudit({
    userId: user.id,
    orgId: result.ticket.orgId,
    ticketId,
    action: 'TICKET_STATUS_CHANGED',
    details: JSON.stringify({ oldStatus, newStatus: validatedStatus }),
  });

    const fullTicket = await getTicketById(ticketId, result.ticket.orgId);
    if (fullTicket && 'requester' in fullTicket) {
      await sendTicketStatusChangedNotification(fullTicket as unknown as Ticket & {
        requester: { email: string; name: string | null } | null;
      }, oldStatus, validatedStatus);
    }

  revalidatePath(`/app/tickets/${ticketId}`);
  revalidatePath('/app');
}

export async function assignTicketAction(
  ticketId: string,
  assigneeId: string | null
) {
  const user = await requireInternalRole();
  const result = await canViewTicket(ticketId);

  await db
    .update(tickets)
    .set({ assigneeId, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));

  await logAudit({
    userId: user.id,
    orgId: result.ticket.orgId,
    ticketId,
    action: 'TICKET_ASSIGNED',
    details: JSON.stringify({ assigneeId }),
  });

  revalidatePath(`/app/tickets/${ticketId}`);
  revalidatePath('/app');
}

export async function updateTicketPriorityAction(
  ticketId: string,
  priority: string
) {
  const user = await requireInternalRole();
  const result = await canViewTicket(ticketId);

  const validatedPriority = ticketPrioritySchema.parse(priority);

  await db
    .update(tickets)
    .set({ priority: validatedPriority, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));

  await logAudit({
    userId: user.id,
    orgId: result.ticket.orgId,
    ticketId,
    action: 'TICKET_PRIORITY_CHANGED',
    details: JSON.stringify({ priority: validatedPriority }),
  });

  revalidatePath(`/app/tickets/${ticketId}`);
  revalidatePath('/app');
}

export async function addTicketCommentAction(
  ticketId: string,
  content: string,
  isInternal: boolean
) {
  const user = await requireInternalRole();
  const result = await canViewTicket(ticketId);

  const [comment] = await db
    .insert(ticketComments)
    .values({
      ticketId,
      userId: user.id,
      content,
      isInternal,
    })
    .returning();

  await logAudit({
    userId: user.id,
    orgId: result.ticket.orgId,
    ticketId,
    action: 'TICKET_COMMENT_ADDED',
    details: JSON.stringify({ isInternal }),
  });

  // Send email notification if public comment from agent
  if (!isInternal && comment) {
    // Update first response time if this is the first internal response
    await updateFirstResponseTime(ticketId);

    const ticket = await getTicketById(ticketId);
    if (ticket) {
      const ticketUrl = `${appBaseUrl}/app/tickets/${ticketId}`;
      await sendAgentReplyNotification(
        ticket as unknown as Ticket & {
          requester: { email: string; name: string | null } | null;
          organization: { name: string };
        },
        {
          ...comment,
          user: { name: user.name, email: user.email },
        },
        ticketUrl
      );
    }
  }

  // Process @mentions in the comment
  await processMentions({
    commentId: comment.id,
    content,
    authorId: user.id,
    ticketId,
    ticketKey: result.ticket.key,
  });

  revalidatePath(`/app/tickets/${ticketId}`);
}

export async function createTicketAction(data: {
  orgId: string;
  subject: string;
  description: string;
  priority: string;
  category: string;
  assigneeId?: string | null;
  requesterEmail?: string | null;
  siteId?: string | null;
  areaId?: string | null;
}) {
  const user = await requireInternalRole();

  const validatedPriority = ticketPrioritySchema.parse(data.priority);
  const validatedCategory = ticketCategorySchema.parse(data.category);

  const subject = z.string().min(1).parse(data.subject);
  const description = z.string().min(1).parse(data.description);
  const orgId = z.string().uuid().parse(data.orgId);

  let requesterEmail: string | null = null;
  if (data.requesterEmail && data.requesterEmail.trim()) {
    requesterEmail = z.string().email().parse(data.requesterEmail.trim());
  }

  let assigneeId: string | null = null;
  if (data.assigneeId) {
    assigneeId = z.string().uuid().parse(data.assigneeId);
  }

  let resolvedSiteId: string | null = null;
  if (data.siteId) {
    resolvedSiteId = z.string().uuid().parse(data.siteId);
    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, resolvedSiteId), eq(sites.orgId, orgId)),
    });
    if (!site) {
      throw new Error('Site not found');
    }
  }

  let resolvedAreaId: string | null = null;
  if (data.areaId) {
    resolvedAreaId = z.string().uuid().parse(data.areaId);
    const area = await db.query.areas.findFirst({
      where: eq(areas.id, resolvedAreaId),
      with: { site: true },
    });
    const site = area?.site as { orgId: string } | undefined;
    if (!area || !site || site.orgId !== orgId) {
      throw new Error('Area not found');
    }
    if (resolvedSiteId && area.siteId !== resolvedSiteId) {
      throw new Error('Area does not belong to site');
    }
    if (!resolvedSiteId) {
      resolvedSiteId = area.siteId;
    }
  }

  const ticketKey = await generateTicketKey();
  const slaTargets = await getOrgSLATargets(orgId, validatedPriority);

  const [ticket] = await db
    .insert(tickets)
    .values({
      key: ticketKey,
      orgId,
      subject,
      description,
      priority: validatedPriority,
      category: validatedCategory,
      status: 'NEW',
      requesterEmail,
      assigneeId,
      siteId: resolvedSiteId,
      areaId: resolvedAreaId,
      slaResponseTargetHours: slaTargets.responseHours,
      slaResolutionTargetHours: slaTargets.resolutionHours,
    })
    .returning();

  // Add ticket created date as public comment
  const createdDate = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  await db.insert(ticketComments).values({
    ticketId: ticket.id,
    content: `Ticket created on ${createdDate}`,
    isInternal: false,
    userId: user.id,
  });

  await logAudit({
    userId: user.id,
    orgId,
    ticketId: ticket.id,
    action: 'TICKET_CREATED',
    details: JSON.stringify({ key: ticketKey }),
  });

  // Send notification to customer admins if this is a customer organization ticket
  const fullTicket = await getTicketById(ticket.id, orgId);
  if (fullTicket && 'organization' in fullTicket && fullTicket.organization) {
      await sendAdminCreatedTicketNotification(fullTicket as unknown as Ticket & {
        organization: { name: string };
      });
  }

  // Trigger automation rules for ticket creation
  if (fullTicket) {
    await triggerOnTicketCreate(fullTicket, user.id);
    // Refetch ticket after automation rules may have modified it
    const updatedTicket = await getTicketById(ticket.id, orgId);
    if (updatedTicket) {
      // Revalidate to show any changes from automation
      revalidatePath('/app');
      return { ticketId: ticket.id, error: null };
    }
  }

  revalidatePath('/app');
  return { ticketId: ticket.id, error: null };
}

export async function addTicketAttachmentAction(formData: FormData) {
  const user = await requireInternalRole();
  const ticketId = formData.get('ticketId');

  if (typeof ticketId !== 'string') {
    throw new Error('Invalid ticket');
  }

  const { ticket } = await canViewTicket(ticketId);
  const items = formData.getAll('attachments');
  const files = items.filter((item): item is File => item instanceof File);

  if (files.length === 0) {
    throw new Error('No files selected');
  }

  // Check quota for all files before uploading
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const quotaCheck = await checkQuota(ticket.orgId, totalSize);
  
  if (!quotaCheck.allowed) {
    throw new Error(quotaCheck.error || 'Storage quota exceeded');
  }

  const attachmentValues = [];
  for (const file of files) {
    const uploaded = await uploadAttachment(ticketId, file);
    attachmentValues.push({
      ticketId,
      orgId: ticket.orgId,
      filename: uploaded.filename,
      contentType: uploaded.contentType,
      size: uploaded.size,
      blobPathname: uploaded.blobPathname,
      storageKey: uploaded.storageKey,
      uploadedBy: user.id,
    });
    
    // Update storage usage after successful upload
    await incrementStorageUsage(ticket.orgId, uploaded.size);
  }

  const insertedAttachments = await db.insert(attachments).values(attachmentValues).returning();

  // Enqueue virus scanning jobs for all attachments
  for (const attachment of insertedAttachments) {
    await enqueueJob({
      type: 'PROCESS_ATTACHMENT',
      maxAttempts: 3,
      data: {
        attachmentId: attachment.id,
        action: 'SCAN' as const,
      },
    });
  }

  await logAudit({
    userId: user.id,
    orgId: ticket.orgId,
    ticketId,
    action: 'TICKET_UPDATED',
    details: JSON.stringify({
      attachmentCount: attachmentValues.length,
    }),
  });

  revalidatePath(`/app/tickets/${ticketId}`);
}
