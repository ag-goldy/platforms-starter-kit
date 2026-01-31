import crypto from 'crypto';

const EXPORT_SIGNED_URL_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours
const EXPORT_SIGNED_URL_SECRET =
  process.env.EXPORT_SIGNED_URL_SECRET || 'change-me-in-production';

export interface ExportSignedUrlParams {
  exportRequestId: string;
  orgId: string;
  expiresAt?: Date;
}

export function generateExportSignedUrl(params: ExportSignedUrlParams): string {
  const expiresAt =
    params.expiresAt ||
    new Date(Date.now() + EXPORT_SIGNED_URL_EXPIRY_SECONDS * 1000);
  const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000);

  const payload = {
    exportRequestId: params.exportRequestId,
    orgId: params.orgId,
    expiresAt: expiresTimestamp,
  };

  const payloadString = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadString).toString('base64url');

  const hmac = crypto.createHmac('sha256', EXPORT_SIGNED_URL_SECRET);
  hmac.update(payloadString);
  const signature = hmac.digest('base64url');

  return `${payloadBase64}.${signature}`;
}

export interface ExportSignedUrlData {
  exportRequestId: string;
  orgId: string;
  expiresAt: number;
}

export function validateExportSignedUrl(
  signedUrl: string
): ExportSignedUrlData | null {
  try {
    const [payloadBase64, signature] = signedUrl.split('.');
    if (!payloadBase64 || !signature) {
      return null;
    }

    const payloadString = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadString) as ExportSignedUrlData;

    const hmac = crypto.createHmac('sha256', EXPORT_SIGNED_URL_SECRET);
    hmac.update(payloadString);
    const expectedSignature = hmac.digest('base64url');

    if (signature !== expectedSignature) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.expiresAt < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function generateSignedExportUrl(
  baseUrl: string,
  params: ExportSignedUrlParams
): string {
  const token = generateExportSignedUrl(params);
  return `${baseUrl}/api/exports/${params.exportRequestId}?token=${token}`;
}
