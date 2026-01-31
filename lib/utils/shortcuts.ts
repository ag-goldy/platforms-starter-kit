/**
 * Keyboard shortcut utilities
 */

export interface KeyboardShortcut {
  key: string;
  description: string;
  category: string;
  action: () => void;
  modifiers?: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  };
}

/**
 * Check if a keyboard event matches a shortcut
 */
export function matchesShortcut(
  event: KeyboardEvent,
  key: string,
  modifiers?: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  }
): boolean {
  // Normalize key comparison
  const normalizedKey = key.toLowerCase();
  const eventKey = event.key.toLowerCase();

  if (eventKey !== normalizedKey && event.code.toLowerCase() !== normalizedKey) {
    return false;
  }

  // Check modifiers
  if (modifiers) {
    if (modifiers.ctrl !== undefined && event.ctrlKey !== modifiers.ctrl) {
      return false;
    }
    if (modifiers.shift !== undefined && event.shiftKey !== modifiers.shift) {
      return false;
    }
    if (modifiers.alt !== undefined && event.altKey !== modifiers.alt) {
      return false;
    }
    if (modifiers.meta !== undefined && event.metaKey !== modifiers.meta) {
      return false;
    }
  } else {
    // If no modifiers specified, ensure none are pressed
    if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
      return false;
    }
  }

  return true;
}

/**
 * Format shortcut for display (e.g., "⌘K" or "Ctrl+K")
 */
export function formatShortcut(
  key: string,
  modifiers?: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  }
): string {
  const parts: string[] = [];

  if (modifiers?.meta) {
    parts.push('⌘');
  }
  if (modifiers?.ctrl) {
    parts.push('Ctrl');
  }
  if (modifiers?.alt) {
    parts.push('Alt');
  }
  if (modifiers?.shift) {
    parts.push('Shift');
  }

  // Format key
  const formattedKey = key.length === 1 ? key.toUpperCase() : key;
  parts.push(formattedKey);

  return parts.join('+');
}

/**
 * Common shortcut keys
 */
export const SHORTCUT_KEYS = {
  OPEN_COMMAND_PALETTE: { key: 'k', meta: true },
  SAVE: { key: 's', meta: true },
  ESCAPE: { key: 'Escape' },
  ENTER: { key: 'Enter' },
  STATUS_NEW: { key: '1', meta: true },
  STATUS_OPEN: { key: '2', meta: true },
  STATUS_IN_PROGRESS: { key: '3', meta: true },
  STATUS_RESOLVED: { key: '4', meta: true },
  STATUS_CLOSED: { key: '5', meta: true },
  PRIORITY_P1: { key: '1', meta: true, shift: true },
  PRIORITY_P2: { key: '2', meta: true, shift: true },
  PRIORITY_P3: { key: '3', meta: true, shift: true },
  PRIORITY_P4: { key: '4', meta: true, shift: true },
} as const;

