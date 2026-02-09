'use client';

import { useMentions } from '@/hooks/use-mentions';
import { cn } from '@/lib/utils';

interface MentionInputProps {
  orgId: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

export function MentionInput({
  orgId,
  value,
  onChange,
  placeholder,
  className,
  rows = 4,
}: MentionInputProps) {
  const {
    textareaRef,
    mentionSuggestions,
    showMentions,
    mentionIndex,
    handleInput,
    handleKeyDown,
    insertMention,
  } = useMentions(orgId);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none',
          className
        )}
      />
      
      {showMentions && (
        <div className="absolute z-50 w-64 mt-1 bg-white border rounded-md shadow-lg">
          {mentionSuggestions.map((user, index) => (
            <button
              key={user.id}
              type="button"
              onClick={() => insertMention(user)}
              className={cn(
                'w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2',
                index === mentionIndex && 'bg-blue-50'
              )}
            >
              <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      
      <p className="text-xs text-gray-500 mt-1">
        Type @ to mention someone
      </p>
    </div>
  );
}
