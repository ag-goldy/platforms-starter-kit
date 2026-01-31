'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatShortcut } from '@/lib/utils/shortcuts';

interface Shortcut {
  keys: { key: string; meta?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean };
  description: string;
  category: string;
}

interface ShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: Shortcut[];
}

export function ShortcutsHelp({ open, onOpenChange, shortcuts }: ShortcutsHelpProps) {
  const grouped = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 max-h-96 overflow-y-auto">
          {Object.entries(grouped).map(([category, categoryShortcuts]) => (
            <div key={category}>
              <h3 className="mb-2 text-sm font-semibold text-gray-700 uppercase">
                {category}
              </h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-md border bg-white p-3"
                  >
                    <span className="text-sm text-gray-700">{shortcut.description}</span>
                    <kbd className="rounded border bg-gray-100 px-2 py-1 text-xs font-mono text-gray-600">
                      {formatShortcut(shortcut.keys.key, shortcut.keys)}
                    </kbd>
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

