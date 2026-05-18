'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ReplyComposer({
  ticketId,
  orgId,
  slug,
}: {
  ticketId: string;
  orgId: string;
  slug: string;
}) {
  const [content, setContent] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  // Simplified slash commands
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && content.startsWith('/status resolved')) {
      e.preventDefault();
      // Execute command logic (simplified for Phase 2)
      setContent(content.replace('/status resolved', '') + '\n[System: Status set to resolved]');
    }
  };

  return (
    <form action="/api/actions/reply" className="space-y-4">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="subdomain" value={slug} />
      <input type="hidden" name="isInternal" value={isInternal ? 'true' : 'false'} />

      <textarea
        name="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`w-full min-h-[120px] p-3 border rounded-md font-mono text-sm ${
          isInternal ? 'bg-amber-50 border-amber-300' : 'bg-background'
        }`}
        placeholder="Type your reply... Use /status, /priority, /assign for quick actions."
        required
      />

      <div className="flex justify-between items-center">
        <div className="text-xs text-muted-foreground">
          Markdown supported. Slash commands: /status, /priority, /assign
        </div>
        <div className="flex gap-2">
          <Button 
            type="button" 
            variant={isInternal ? 'default' : 'outline'}
            onClick={() => setIsInternal(!isInternal)}
            className={isInternal ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
          >
            {isInternal ? 'Internal Note' : 'Make Internal'}
          </Button>
          <Button type="submit">Send Reply</Button>
        </div>
      </div>
    </form>
  );
}
