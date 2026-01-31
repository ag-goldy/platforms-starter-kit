'use client';

import { useState, useEffect } from 'react';
import { matchesShortcut, SHORTCUT_KEYS } from '@/lib/utils/shortcuts';

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Cmd+K even in inputs
        if (matchesShortcut(e, SHORTCUT_KEYS.OPEN_COMMAND_PALETTE.key, { meta: true })) {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      // Open command palette (Cmd+K)
      if (matchesShortcut(e, SHORTCUT_KEYS.OPEN_COMMAND_PALETTE.key, { meta: true })) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { isOpen, setIsOpen };
}

