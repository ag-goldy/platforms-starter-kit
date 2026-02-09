'use client';

import { useEffect, useCallback } from 'react';

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey;

        if (keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Common shortcuts
export const defaultShortcuts = {
  // Navigation
  goToTickets: { key: 't', description: 'Go to Tickets' },
  goToDashboard: { key: 'd', description: 'Go to Dashboard' },
  goToUsers: { key: 'u', description: 'Go to Users' },
  goToOrganizations: { key: 'o', description: 'Go to Organizations' },
  goToReports: { key: 'r', description: 'Go to Reports' },
  
  // Ticket actions
  newTicket: { key: 'n', ctrl: true, description: 'New Ticket' },
  searchTickets: { key: 'k', ctrl: true, description: 'Search Tickets' },
  closeTicket: { key: 'w', description: 'Close Ticket' },
  
  // General
  showShortcuts: { key: '?', description: 'Show Keyboard Shortcuts' },
  toggleTheme: { key: 'l', ctrl: true, description: 'Toggle Light/Dark Mode' },
};
