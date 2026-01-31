import { Attachment } from '@/db/schema';

interface AttachmentListProps {
  attachments: Attachment[];
  emptyText?: string;
  downloadTokens?: Record<string, string>;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function AttachmentList({
  attachments,
  emptyText = 'No attachments yet.',
  downloadTokens,
}: AttachmentListProps) {
  if (!attachments || attachments.length === 0) {
    return <p className="text-sm text-gray-500">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex items-center justify-between rounded-md border bg-white p-3"
        >
          <div>
            <p className="text-sm font-medium text-gray-900">
              {attachment.filename}
            </p>
            <p className="text-xs text-gray-500">{attachment.contentType}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span>{formatSize(attachment.size)}</span>
            <a
              href={`/api/attachments/${attachment.id}${
                downloadTokens?.[attachment.id]
                  ? `?token=${encodeURIComponent(downloadTokens[attachment.id])}`
                  : ''
              }`}
              className="text-blue-600 hover:text-blue-700"
            >
              Download
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
