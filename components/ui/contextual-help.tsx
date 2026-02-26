'use client';

import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';

interface ContextualHelpProps {
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
  iconClassName?: string;
}

export function ContextualHelp({
  title,
  description,
  children,
  className,
  iconClassName,
}: ContextualHelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center justify-center rounded-full p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors",
            iconClassName
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className={cn("w-80", className)}
        align="start"
        side="top"
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <h4 className="font-medium text-sm">{title}</h4>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <p className="text-sm text-gray-600">{description}</p>
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Help tooltip for inline use
export function HelpTooltip({
  content,
  children,
}: {
  content: string;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 text-sm">
        {content}
      </PopoverContent>
    </Popover>
  );
}
