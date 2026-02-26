'use client';

import { useEffect, useCallback } from 'react';

type KeyHandler = (event: KeyboardEvent) => void;

interface HotkeyConfig {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: KeyHandler;
  preventDefault?: boolean;
}

export function useHotkeys(key: string, handler: KeyHandler, deps: React.DependencyList = []) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const keys = key.toLowerCase().split('+');
      const mainKey = keys[keys.length - 1];
      const needsCtrl = keys.includes('ctrl');
      const needsMeta = keys.includes('cmd') || keys.includes('meta');
      const needsShift = keys.includes('shift');
      const needsAlt = keys.includes('alt');

      const keyMatches = event.key.toLowerCase() === mainKey;
      const ctrlMatches = needsCtrl === event.ctrlKey;
      const metaMatches = needsMeta === event.metaKey;
      const shiftMatches = needsShift === event.shiftKey;
      const altMatches = needsAlt === event.altKey;

      if (keyMatches && ctrlMatches && metaMatches && shiftMatches && altMatches) {
        handler(event);
      }
    },
    [key, handler, ...deps]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export function useMultipleHotkeys(configs: HotkeyConfig[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const config of configs) {
        const keys = config.key.toLowerCase().split('+');
        const mainKey = keys[keys.length - 1];
        const needsCtrl = keys.includes('ctrl') || config.ctrl;
        const needsMeta = keys.includes('cmd') || keys.includes('meta') || config.meta;
        const needsShift = keys.includes('shift') || config.shift;
        const needsAlt = keys.includes('alt') || config.alt;

        const keyMatches = event.key.toLowerCase() === mainKey;
        const ctrlMatches = needsCtrl === event.ctrlKey;
        const metaMatches = needsMeta === event.metaKey;
        const shiftMatches = needsShift === event.shiftKey;
        const altMatches = needsAlt === event.altKey;

        if (keyMatches && ctrlMatches && metaMatches && shiftMatches && altMatches) {
          if (config.preventDefault !== false) {
            event.preventDefault();
          }
          config.handler(event);
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [configs]);
}

// Predefined shortcuts for the customer portal
export const CUSTOMER_PORTAL_SHORTCUTS = {
  // Navigation
  OPEN_COMMAND: { key: 'cmd+k', description: 'Open command palette' },
  CLOSE_MODAL: { key: 'esc', description: 'Close slide-over/modal' },
  
  // Actions
  CREATE_TICKET: { key: 'c', description: 'Create new ticket' },
  REFRESH: { key: 'r', description: 'Refresh current widget' },
  FOCUS_TICKETS: { key: 't', description: 'Focus ticket inbox' },
  TOGGLE_STATUS: { key: 's', description: 'Toggle status panel' },
  
  // Navigation within lists
  NEXT_ITEM: { key: 'j', description: 'Next item' },
  PREV_ITEM: { key: 'k', description: 'Previous item' },
  SELECT_ITEM: { key: 'enter', description: 'Select item' },
} as const;
