import { db } from '@/db';
import { attachments } from '@/db/schema';
import { consumeTicketToken } from '@/lib/tickets/magic-links';
import { eq } from 'drizzle-orm';
import { generateSignedAttachmentUrl } from './signed-urls';
import { appBaseUrl } from '@/lib/utils';

export async function authorizeAttachmentTokenDownload(params: {
  attachmentId: string;
  token: string;
  usedIp?: string | null;
}) {
  const tokenData = await consumeTicketToken({
    token: params.token,
    purpose: 'VIEW',
    usedIp: params.usedIp ?? null,
  });

  if (!tokenData) {
    return null;
  }

  const attachment = await db.query.attachments.findFirst({
    where: eq(attachments.id, params.attachmentId),
    with: {
      ticket: true,
    },
  });

  if (!attachment || !attachment.ticket) {
    return null;
  }

  if (attachment.ticketId !== tokenData.ticketId) {
    return null;
  }

  if (attachment.ticket.requesterEmail !== tokenData.email) {
    return null;
  }

  return attachment;
}

/**
 * Generate a signed URL for an attachment
 * Used for secure, time-limited access
 */
export async function getSignedAttachmentUrl(attachmentId: string): Promise<string | null> {
  const attachment = await db.query.attachments.findFirst({
    where: eq(attachments.id, attachmentId),
    with: {
      ticket: true,
    },
  });

  if (!attachment || !attachment.ticket) {
    return null;
  }

  return generateSignedAttachmentUrl(appBaseUrl, {
    attachmentId: attachment.id,
    orgId: attachment.orgId,
    ticketId: attachment.ticketId,
  });
}
