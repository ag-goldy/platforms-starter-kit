'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

interface ShortcutGroup {
  name: string;
  shortcuts: { keys: string[]; description: string }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    name: 'Navigation',
    shortcuts: [
      { keys: ['T'], description: 'Go to Tickets' },
      { keys: ['D'], description: 'Go to Dashboard' },
      { keys: ['U'], description: 'Go to Users' },
      { keys: ['O'], description: 'Go to Organizations' },
      { keys: ['R'], description: 'Go to Reports' },
    ],
  },
  {
    name: 'Tickets',
    shortcuts: [
      { keys: ['Ctrl', 'N'], description: 'New Ticket' },
      { keys: ['Ctrl', 'K'], description: 'Search Tickets' },
      { keys: ['W'], description: 'Close Ticket' },
      { keys: ['A'], description: 'Assign to Me' },
    ],
  },
  {
    name: 'General',
    shortcuts: [
      { keys: ['?'], description: 'Show Keyboard Shortcuts' },
      { keys: ['Ctrl', 'L'], description: 'Toggle Light/Dark Mode' },
      { keys: ['/'], description: 'Focus Search' },
      { keys: ['Esc'], description: 'Close Modal / Cancel' },
    ],
  },
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          title="Keyboard Shortcuts (?)"
        >
          <Keyboard className="h-4 w-4" />
          <span className="hidden lg:inline">Shortcuts</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {shortcutGroups.map((group) => (
            <div key={group.name}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {group.name}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <span key={keyIdx}>
                          <kbd className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium bg-muted rounded border">
                            {key}
                          </kbd>
                          {keyIdx < shortcut.keys.length - 1 && (
                            <span className="mx-1 text-muted-foreground">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
