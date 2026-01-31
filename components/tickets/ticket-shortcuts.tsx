'use client';

import { useEffect, useState } from 'react';
import { CommandPalette, type Command } from '@/components/ui/command-palette';
import { ShortcutsHelp } from '@/components/ui/shortcuts-help';
import { matchesShortcut, SHORTCUT_KEYS } from '@/lib/utils/shortcuts';

declare global {
  interface Window {
    __openShortcutsHelp?: () => void;
  }
}

interface TicketShortcutsProps {
  ticketId: string;
  currentStatus: string;
  currentPriority: string;
  onStatusChange: (status: string) => Promise<void>;
  onPriorityChange: (priority: string) => Promise<void>;
}

export function TicketShortcuts(props: TicketShortcutsProps) {
  const { onStatusChange, onPriorityChange } = props;
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  // Expose help function globally for button click
  useEffect(() => {
    window.__openShortcutsHelp = () => setShortcutsHelpOpen(true);
    return () => {
      delete window.__openShortcutsHelp;
    };
  }, []);

  // Build commands for command palette
  const commands: Command[] = [
    {
      id: 'status-new',
      label: 'Set Status: New',
      description: 'Change ticket status to New',
      category: 'Status',
      shortcut: '⌘1',
      action: () => onStatusChange('NEW'),
    },
    {
      id: 'status-open',
      label: 'Set Status: Open',
      description: 'Change ticket status to Open',
      category: 'Status',
      shortcut: '⌘2',
      action: () => onStatusChange('OPEN'),
    },
    {
      id: 'status-in-progress',
      label: 'Set Status: In Progress',
      description: 'Change ticket status to In Progress',
      category: 'Status',
      shortcut: '⌘3',
      action: () => onStatusChange('IN_PROGRESS'),
    },
    {
      id: 'status-resolved',
      label: 'Set Status: Resolved',
      description: 'Change ticket status to Resolved',
      category: 'Status',
      shortcut: '⌘4',
      action: () => onStatusChange('RESOLVED'),
    },
    {
      id: 'status-closed',
      label: 'Set Status: Closed',
      description: 'Change ticket status to Closed',
      category: 'Status',
      shortcut: '⌘5',
      action: () => onStatusChange('CLOSED'),
    },
    {
      id: 'priority-p1',
      label: 'Set Priority: P1 (Critical)',
      description: 'Change ticket priority to P1',
      category: 'Priority',
      shortcut: '⌘⇧1',
      action: () => onPriorityChange('P1'),
    },
    {
      id: 'priority-p2',
      label: 'Set Priority: P2 (High)',
      description: 'Change ticket priority to P2',
      category: 'Priority',
      shortcut: '⌘⇧2',
      action: () => onPriorityChange('P2'),
    },
    {
      id: 'priority-p3',
      label: 'Set Priority: P3 (Medium)',
      description: 'Change ticket priority to P3',
      category: 'Priority',
      shortcut: '⌘⇧3',
      action: () => onPriorityChange('P3'),
    },
    {
      id: 'priority-p4',
      label: 'Set Priority: P4 (Low)',
      description: 'Change ticket priority to P4',
      category: 'Priority',
      shortcut: '⌘⇧4',
      action: () => onPriorityChange('P4'),
    },
    {
      id: 'help',
      label: 'Show Keyboard Shortcuts',
      description: 'View all available keyboard shortcuts',
      category: 'General',
      shortcut: '⌘?',
      action: () => setShortcutsHelpOpen(true),
    },
  ];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Cmd+K to open command palette even in inputs
        if (matchesShortcut(e, SHORTCUT_KEYS.OPEN_COMMAND_PALETTE.key, { meta: true })) {
          e.preventDefault();
          setCommandPaletteOpen(true);
        }
        return;
      }

      // Command palette (Cmd+K)
      if (matchesShortcut(e, SHORTCUT_KEYS.OPEN_COMMAND_PALETTE.key, { meta: true })) {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Shortcuts help (Cmd+?)
      if (e.key === '?' && e.metaKey) {
        e.preventDefault();
        setShortcutsHelpOpen(true);
        return;
      }

      // Status shortcuts (Cmd+1-5)
      if (e.metaKey && !e.shiftKey && !e.altKey && !e.ctrlKey) {
        if (e.key === '1') {
          e.preventDefault();
          onStatusChange('NEW');
          return;
        }
        if (e.key === '2') {
          e.preventDefault();
          onStatusChange('OPEN');
          return;
        }
        if (e.key === '3') {
          e.preventDefault();
          onStatusChange('IN_PROGRESS');
          return;
        }
        if (e.key === '4') {
          e.preventDefault();
          onStatusChange('RESOLVED');
          return;
        }
        if (e.key === '5') {
          e.preventDefault();
          onStatusChange('CLOSED');
          return;
        }
      }

      // Priority shortcuts (Cmd+Shift+1-4)
      if (e.metaKey && e.shiftKey && !e.altKey && !e.ctrlKey) {
        if (e.key === '1') {
          e.preventDefault();
          onPriorityChange('P1');
          return;
        }
        if (e.key === '2') {
          e.preventDefault();
          onPriorityChange('P2');
          return;
        }
        if (e.key === '3') {
          e.preventDefault();
          onPriorityChange('P3');
          return;
        }
        if (e.key === '4') {
          e.preventDefault();
          onPriorityChange('P4');
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStatusChange, onPriorityChange]);

  const shortcutsForHelp = [
    { keys: { key: 'k', meta: true }, description: 'Open command palette', category: 'General' },
    { keys: { key: '?', meta: true }, description: 'Show keyboard shortcuts', category: 'General' },
    { keys: { key: '1', meta: true }, description: 'Set status: New', category: 'Status' },
    { keys: { key: '2', meta: true }, description: 'Set status: Open', category: 'Status' },
    { keys: { key: '3', meta: true }, description: 'Set status: In Progress', category: 'Status' },
    { keys: { key: '4', meta: true }, description: 'Set status: Resolved', category: 'Status' },
    { keys: { key: '5', meta: true }, description: 'Set status: Closed', category: 'Status' },
    { keys: { key: '1', meta: true, shift: true }, description: 'Set priority: P1', category: 'Priority' },
    { keys: { key: '2', meta: true, shift: true }, description: 'Set priority: P2', category: 'Priority' },
    { keys: { key: '3', meta: true, shift: true }, description: 'Set priority: P3', category: 'Priority' },
    { keys: { key: '4', meta: true, shift: true }, description: 'Set priority: P4', category: 'Priority' },
  ];

  return (
    <>
      <CommandPalette
        commands={commands}
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
      <ShortcutsHelp
        open={shortcutsHelpOpen}
        onOpenChange={setShortcutsHelpOpen}
        shortcuts={shortcutsForHelp}
      />
    </>
  );
}
