const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'application/json',
  'text/html',
  'text/xml',
  'application/xml',
]);

const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'txt',
  'log',
  'md',
  'csv',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'zip',
  'json',
  'html',
  'xml',
]);

export function getAttachmentMaxBytes() {
  const configured = Number(process.env.ATTACHMENT_MAX_BYTES);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return DEFAULT_MAX_BYTES;
}

function getExtension(filename: string) {
  const parts = filename.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase();
}

export function validateAttachmentFile(file: File) {
  const maxBytes = getAttachmentMaxBytes();

  if (file.size > maxBytes) {
    throw new Error('File exceeds size limit');
  }

  const safeName = (file.name || 'attachment').replace(
    /[^a-zA-Z0-9._() -]/g,
    '_'
  );
  const extension = getExtension(safeName);
  const contentType = file.type || 'application/octet-stream';

  if (!ALLOWED_CONTENT_TYPES.has(contentType) && !ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error('File type is not allowed');
  }

  return {
    filename: safeName,
    contentType,
    size: file.size,
  };
}
