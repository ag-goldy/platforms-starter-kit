/**
 * Vercel Blob Storage - Standardized Upload Helpers
 * 
 * Provides:
 * - Standardized path structure for all file types
 * - Sanitized filenames
 * - Consistent access patterns
 * 
 * Path Structure:
 * - attachments/{orgId}/{ticketId}/{timestamp}-{filename}
 * - kb/{orgId}/{articleId}/{filename}
 * - branding/{orgId}/{logo|favicon}
 * - avatars/{userId}/{filename}
 * - exports/{orgId}/{exportId}.{format}
 * - reports/{orgId}/{reportId}.pdf
 */

import { put, del, list, head, type PutBlobResult } from '@vercel/blob';

// Maximum file sizes (in bytes)
export const FILE_LIMITS = {
  attachment: 10 * 1024 * 1024,      // 10MB
  kbImage: 5 * 1024 * 1024,          // 5MB
  avatar: 2 * 1024 * 1024,           // 2MB
  branding: 5 * 1024 * 1024,         // 5MB
  export: 100 * 1024 * 1024,         // 100MB
  report: 50 * 1024 * 1024,          // 50MB
} as const;

// Allowed MIME types
export const ALLOWED_TYPES = {
  attachment: [
    'image/*',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/json',
    'application/xml',
  ],
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  avatar: ['image/jpeg', 'image/png', 'image/webp'],
  branding: ['image/png', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'],
} as const;

/**
 * Sanitize filename for safe storage
 * - Removes special characters
 * - Limits length
 * - Preserves extension
 */
export function sanitizeFilename(name: string): string {
  // Get extension
  const lastDot = name.lastIndexOf('.');
  const extension = lastDot > 0 ? name.slice(lastDot) : '';
  const baseName = lastDot > 0 ? name.slice(0, lastDot) : name;
  
  // Sanitize base name (keep alphanumeric, spaces become underscores)
  const sanitized = baseName
    .replace(/[^a-zA-Z0-9\s.-]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100);
  
  return `${sanitized}${extension}`.toLowerCase();
}

/**
 * Path generators - internal use
 */
const paths = {
  attachment: (orgId: string, ticketId: string, filename: string) =>
    `attachments/${orgId}/${ticketId}/${Date.now()}-${sanitizeFilename(filename)}`,
  
  kbImage: (orgId: string, articleId: string, filename: string) =>
    `kb/${orgId}/${articleId}/${sanitizeFilename(filename)}`,
  
  branding: (orgId: string, type: 'logo' | 'favicon') =>
    `branding/${orgId}/${type}`,
  
  avatar: (userId: string, filename: string) =>
    `avatars/${userId}/${Date.now()}-${sanitizeFilename(filename)}`,
  
  export: (orgId: string, exportId: string, format: string) =>
    `exports/${orgId}/${exportId}.${format}`,
  
  report: (orgId: string, reportId: string) =>
    `reports/${orgId}/${reportId}.pdf`,
  
  temp: (prefix: string, filename: string) =>
    `temp/${prefix}/${Date.now()}-${sanitizeFilename(filename)}`,
};

// Upload result type
export interface UploadResult {
  success: boolean;
  url?: string;
  pathname?: string;
  size?: number;
  error?: string;
}

/**
 * Validate file before upload
 */
function validateFile(
  file: File,
  maxSize: number,
  allowedTypes?: string[]
): { valid: boolean; error?: string } {
  // Check size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`,
    };
  }
  
  // Check type if specified
  if (allowedTypes && allowedTypes.length > 0) {
    const isAllowed = allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.replace('/*', '/'));
      }
      return file.type === type;
    });
    
    if (!isAllowed) {
      return {
        valid: false,
        error: `File type "${file.type}" not allowed`,
      };
    }
  }
  
  return { valid: true };
}

/**
 * Upload a ticket attachment
 */
export async function uploadAttachment(
  orgId: string,
  ticketId: string,
  file: File
): Promise<UploadResult> {
  const validation = validateFile(file, FILE_LIMITS.attachment, ALLOWED_TYPES.attachment);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  try {
    const path = paths.attachment(orgId, ticketId, file.name);
    const result = await put(path, file, {
      access: 'public',
      contentType: file.type,
    });
    
    return {
      success: true,
      url: result.url,
      pathname: result.pathname,
      size: file.size,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    console.error('[Blob] Attachment upload failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Upload a KB article image
 */
export async function uploadKBImage(
  orgId: string,
  articleId: string,
  file: File
): Promise<UploadResult> {
  const validation = validateFile(file, FILE_LIMITS.kbImage, ALLOWED_TYPES.image);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  try {
    const path = paths.kbImage(orgId, articleId, file.name);
    const result = await put(path, file, {
      access: 'public',
      contentType: file.type,
    });
    
    return {
      success: true,
      url: result.url,
      pathname: result.pathname,
      size: file.size,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    console.error('[Blob] KB image upload failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Upload organization branding (logo or favicon)
 */
export async function uploadBranding(
  orgId: string,
  type: 'logo' | 'favicon',
  file: File
): Promise<UploadResult> {
  const validation = validateFile(file, FILE_LIMITS.branding, ALLOWED_TYPES.branding);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  try {
    const path = paths.branding(orgId, type);
    const result = await put(path, file, {
      access: 'public',
      contentType: file.type,
      // Overwrite existing branding
      allowOverwrite: true,
    });
    
    return {
      success: true,
      url: result.url,
      pathname: result.pathname,
      size: file.size,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    console.error('[Blob] Branding upload failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Upload user avatar
 */
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<UploadResult> {
  const validation = validateFile(file, FILE_LIMITS.avatar, ALLOWED_TYPES.avatar);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  try {
    const path = paths.avatar(userId, file.name);
    const result = await put(path, file, {
      access: 'public',
      contentType: file.type,
    });
    
    return {
      success: true,
      url: result.url,
      pathname: result.pathname,
      size: file.size,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    console.error('[Blob] Avatar upload failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Upload export file (from background job)
 */
export async function uploadExport(
  orgId: string,
  exportId: string,
  format: string,
  file: Buffer | Blob,
  contentType: string
): Promise<UploadResult> {
  try {
    const path = paths.export(orgId, exportId, format);
    const result = await put(path, file, {
      access: 'public',
      contentType,
    });
    
    return {
      success: true,
      url: result.url,
      pathname: result.pathname,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    console.error('[Blob] Export upload failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Upload report PDF
 */
export async function uploadReport(
  orgId: string,
  reportId: string,
  file: Buffer | Blob
): Promise<UploadResult> {
  try {
    const path = paths.report(orgId, reportId);
    const result = await put(path, file, {
      access: 'public',
      contentType: 'application/pdf',
    });
    
    return {
      success: true,
      url: result.url,
      pathname: result.pathname,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    console.error('[Blob] Report upload failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Upload temporary file (auto-deleted after processing)
 */
export async function uploadTemp(
  prefix: string,
  file: File
): Promise<UploadResult> {
  try {
    const path = paths.temp(prefix, file.name);
    const result = await put(path, file, {
      access: 'public',
      contentType: file.type,
    });
    
    return {
      success: true,
      url: result.url,
      pathname: result.pathname,
      size: file.size,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    console.error('[Blob] Temp upload failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Delete a file from blob storage
 */
export async function deleteFile(pathname: string): Promise<{ success: boolean; error?: string }> {
  try {
    await del(pathname);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delete failed';
    console.error('[Blob] Delete failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Delete all attachments for a ticket
 */
export async function deleteTicketAttachments(orgId: string, ticketId: string): Promise<number> {
  try {
    const prefix = `attachments/${orgId}/${ticketId}/`;
    const { blobs } = await list({ prefix });
    
    for (const blob of blobs) {
      await del(blob.pathname);
    }
    
    console.log(`[Blob] Deleted ${blobs.length} attachments for ticket ${ticketId}`);
    return blobs.length;
  } catch (error) {
    console.error('[Blob] Failed to delete ticket attachments:', error);
    return 0;
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(url: string): Promise<{
  size: number;
  contentType: string;
  uploadedAt: Date;
} | null> {
  try {
    const metadata = await head(url);
    return {
      size: metadata.size,
      contentType: metadata.contentType,
      uploadedAt: metadata.uploadedAt,
    };
  } catch (error) {
    console.error('[Blob] Failed to get metadata:', error);
    return null;
  }
}

/**
 * List files by prefix
 */
export async function listFiles(prefix: string): Promise<PutBlobResult[]> {
  try {
    const { blobs } = await list({ prefix });
    return blobs;
  } catch (error) {
    console.error('[Blob] Failed to list files:', error);
    return [];
  }
}

/**
 * Extract org ID from blob pathname
 * Useful for authorization checks
 */
export function extractOrgIdFromPath(pathname: string): string | null {
  // attachments/{orgId}/...
  // kb/{orgId}/...
  // branding/{orgId}/...
  // exports/{orgId}/...
  // reports/{orgId}/...
  
  const parts = pathname.split('/');
  if (parts.length >= 2) {
    return parts[1];
  }
  return null;
}

/**
 * Generate a signed URL for temporary access (placeholder for future implementation)
 * Currently just returns the public URL since Vercel Blob doesn't support signed URLs natively
 */
export async function getSecureUrl(
  blobUrl: string,
  _expiresInSeconds: number = 3600
): Promise<string> {
  // Vercel Blob doesn't support signed URLs yet
  // In the future, this could implement a proxy pattern
  return blobUrl;
}
