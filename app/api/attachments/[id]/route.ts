import { NextRequest } from 'next/server';
import { attachments } from '@/db/schema';
import { AuthorizationError, canDownloadAttachment } from '@/lib/auth/permissions';
import { getClientIP } from '@/lib/rate-limit';
import { headers } from 'next/headers';
import { authorizeAttachmentTokenDownload } from '@/lib/attachments/access';
import { validateSignedUrl } from '@/lib/attachments/signed-urls';
import { getDownloadUrl } from '@vercel/blob';
import { db } from '@/db';
import { eq } from 'drizzle-orm';

async function streamBlob(attachment: typeof attachments.$inferSelect) {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    return new Response('Blob storage is not configured', { status: 500 });
  }

  // Handle both old public URLs and new pathnames
  const isPathname = !attachment.storageKey.startsWith('http');
  const pathname = isPathname ? attachment.storageKey : attachment.blobPathname;

  if (!pathname) {
    return new Response('Attachment is unavailable', { status: 404 });
  }

  try {
    let blobResponse: Response;
    let contentType: string | null = null;

    if (isPathname) {
      // Public blob: use getDownloadUrl with the pathname
      // getDownloadUrl works with pathnames for public blobs
      const downloadUrl = await getDownloadUrl(pathname);
      blobResponse = await fetch(downloadUrl);
      contentType = blobResponse.headers.get('content-type');
    } else {
      // Public URL stored directly (for public blobs or legacy)
      blobResponse = await fetch(attachment.storageKey);
    }

  if (!blobResponse.ok || !blobResponse.body) {
    return new Response('Attachment not found', { status: 404 });
  }

  const responseHeaders = new Headers();
  responseHeaders.set(
    'content-type',
      contentType ||
    attachment.contentType ||
      blobResponse.headers.get('content-type') ||
      'application/octet-stream'
  );
  responseHeaders.set(
    'content-disposition',
    `attachment; filename="${attachment.filename.replace(/"/g, '')}"`
  );
  responseHeaders.set('cache-control', 'private, max-age=60');
  responseHeaders.set('content-length', attachment.size.toString());

  return new Response(blobResponse.body, {
    status: 200,
    headers: responseHeaders,
  });
  } catch (error) {
    console.error('[Attachments] Failed to fetch blob:', error);
    return new Response('Attachment not found', { status: 404 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const attachmentId = id;
  const token = request.nextUrl.searchParams.get('token');
  const signed = request.nextUrl.searchParams.get('signed');
  const headersList = await headers();
  const ip = getClientIP(headersList);

  try {
    // Handle signed URL (new method)
    if (signed) {
      const signedData = validateSignedUrl(signed);
      if (!signedData) {
        return new Response('Invalid or expired signed URL', { status: 403 });
      }

      // Verify attachment ID matches
      if (signedData.attachmentId !== attachmentId) {
        return new Response('Invalid signed URL', { status: 403 });
      }

      // Fetch attachment and verify orgId and ticketId match
      const attachment = await db.query.attachments.findFirst({
        where: eq(attachments.id, attachmentId),
        with: {
          ticket: true,
        },
      });

      if (!attachment) {
        return new Response('Not found', { status: 404 });
      }

      // Verify org and ticket match
      if (attachment.orgId !== signedData.orgId || attachment.ticketId !== signedData.ticketId) {
        return new Response('Invalid signed URL', { status: 403 });
      }

      // Block access to quarantined files
      if (attachment.isQuarantined) {
        return new Response('This file has been quarantined due to security concerns. Please contact support.', { status: 403 });
      }

      return streamBlob(attachment);
    }

    // Handle magic link token (legacy method)
    if (token) {
      const attachment = await authorizeAttachmentTokenDownload({
        attachmentId,
        token,
        usedIp: ip,
      });

      if (!attachment) {
        return new Response('Not found', { status: 404 });
      }

      // Block access to quarantined files
      if (attachment.isQuarantined) {
        return new Response('This file has been quarantined due to security concerns. Please contact support.', { status: 403 });
      }

      return streamBlob(attachment);
    }

    // Handle authenticated user access
    const { attachment } = await canDownloadAttachment(attachmentId);
    
    // Block access to quarantined files
    if (attachment.isQuarantined) {
      return new Response('This file has been quarantined due to security concerns. Please contact support.', { status: 403 });
    }
    
    return streamBlob(attachment);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return new Response('Forbidden', { status: 403 });
    }

    console.error('[Attachments] Download failed:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
