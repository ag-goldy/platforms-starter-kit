/**
 * Signed URL generation and validation for attachments
 * 
 * Generates time-limited, cryptographically signed URLs that include:
 * - Attachment ID
 * - Organization ID (for tenant isolation)
 * - Ticket ID (for authorization)
 * - Expiry timestamp
 * 
 * URLs are valid for 15 minutes by default
 */

import crypto from 'crypto';

const SIGNED_URL_EXPIRY_SECONDS = 15 * 60; // 15 minutes
const SIGNED_URL_SECRET = process.env.ATTACHMENT_SIGNED_URL_SECRET || 'change-me-in-production';

export interface SignedUrlParams {
  attachmentId: string;
  orgId: string;
  ticketId: string;
  expiresAt?: Date;
}

/**
 * Generate a signed URL for an attachment
 */
export function generateSignedUrl(params: SignedUrlParams): string {
  const expiresAt = params.expiresAt || new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000);
  const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000);

  // Create payload
  const payload = {
    attachmentId: params.attachmentId,
    orgId: params.orgId,
    ticketId: params.ticketId,
    expiresAt: expiresTimestamp,
  };

  const payloadString = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadString).toString('base64url');

  // Generate signature
  const hmac = crypto.createHmac('sha256', SIGNED_URL_SECRET);
  hmac.update(payloadString);
  const signature = hmac.digest('base64url');

  // Combine payload and signature
  return `${payloadBase64}.${signature}`;
}

export interface SignedUrlData {
  attachmentId: string;
  orgId: string;
  ticketId: string;
  expiresAt: number;
}

/**
 * Validate and parse a signed URL
 * 
 * @param signedUrl - The signed URL token
 * @returns Parsed data if valid, null if invalid or expired
 */
export function validateSignedUrl(signedUrl: string): SignedUrlData | null {
  try {
    const [payloadBase64, signature] = signedUrl.split('.');
    if (!payloadBase64 || !signature) {
      return null;
    }

    // Decode payload
    const payloadString = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadString) as SignedUrlData;

    // Verify signature
    const hmac = crypto.createHmac('sha256', SIGNED_URL_SECRET);
    hmac.update(payloadString);
    const expectedSignature = hmac.digest('base64url');

    if (signature !== expectedSignature) {
      return null; // Invalid signature
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.expiresAt < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null; // Invalid format
  }
}

/**
 * Generate a full signed URL for an attachment
 */
export function generateSignedAttachmentUrl(
  baseUrl: string,
  params: SignedUrlParams
): string {
  const token = generateSignedUrl(params);
  return `${baseUrl}/api/attachments/${params.attachmentId}?signed=${token}`;
}
