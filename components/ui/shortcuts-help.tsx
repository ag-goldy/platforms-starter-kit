'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Command, Keyboard } from 'lucide-react';

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  // Global
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'Global' },
  { keys: ['⌘', 'K'], description: 'Open command palette', category: 'Global' },
  { keys: ['Esc'], description: 'Close modal / Cancel', category: 'Global' },
  
  // Navigation
  { keys: ['G', 'D'], description: 'Go to Dashboard', category: 'Navigation' },
  { keys: ['G', 'T'], description: 'Go to Tickets', category: 'Navigation' },
  { keys: ['G', 'U'], description: 'Go to Users', category: 'Navigation' },
  { keys: ['G', 'O'], description: 'Go to Organizations', category: 'Navigation' },
  { keys: ['G', 'K'], description: 'Go to Knowledge Base', category: 'Navigation' },
  { keys: ['G', 'S'], description: 'Go to Settings', category: 'Navigation' },
  { keys: ['G', 'N'], description: 'Go to Notifications', category: 'Navigation' },
  
  // Tickets
  { keys: ['C', 'T'], description: 'Create new ticket', category: 'Tickets' },
  { keys: ['J'], description: 'Next ticket', category: 'Tickets' },
  { keys: ['K'], description: 'Previous ticket', category: 'Tickets' },
  { keys: ['O'], description: 'Open selected ticket', category: 'Tickets' },
  { keys: ['Space'], description: 'Select ticket', category: 'Tickets' },
  { keys: ['A'], description: 'Assign ticket', category: 'Tickets' },
  { keys: ['S'], description: 'Change status', category: 'Tickets' },
  { keys: ['P'], description: 'Change priority', category: 'Tickets' },
  { keys: ['R'], description: 'Reply to ticket', category: 'Tickets' },
  { keys: ['I'], description: 'Add internal note', category: 'Tickets' },
  { keys: ['M'], description: 'Merge tickets', category: 'Tickets' },
  
  // Ticket Detail
  { keys: ['E'], description: 'Edit ticket', category: 'Ticket Detail' },
  { keys: ['⌘', 'Enter'], description: 'Submit comment', category: 'Ticket Detail' },
  { keys: ['Shift', 'C'], description: 'Close ticket', category: 'Ticket Detail' },
  { keys: ['Shift', 'R'], description: 'Reopen ticket', category: 'Ticket Detail' },
  
  // Search
  { keys: ['/'], description: 'Focus search', category: 'Search' },
  { keys: ['⌘', 'F'], description: 'Find in page', category: 'Search' },
  
  // AI
  { keys: ['⌘', 'Shift', 'K'], description: 'Ask Zeus AI', category: 'AI' },
];

export function ShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show shortcuts on '?' (but not when typing in inputs)
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setIsOpen(true);
      }

      // Close on Escape
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Listen for custom event
    const handleShowShortcuts = () => setIsOpen(true);
    window.addEventListener('show-shortcuts-help', handleShowShortcuts);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('show-shortcuts-help', handleShowShortcuts);
    };
  }, []);

  const categories = ['All', ...Array.from(new Set(shortcuts.map((s) => s.category)))];

  const filteredShortcuts =
    selectedCategory === 'All'
      ? shortcuts
      : shortcuts.filter((s) => s.category === selectedCategory);

  // Group by category when showing all
  const groupedShortcuts =
    selectedCategory === 'All'
      ? categories.slice(1).reduce((acc, category) => {
          acc[category] = shortcuts.filter((s) => s.category === category);
          return acc;
        }, {} as Record<string, Shortcut[]>)
      : { [selectedCategory]: filteredShortcuts };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={() => setIsOpen(false)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Keyboard className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Keyboard Shortcuts
                </h2>
                <p className="text-sm text-gray-500">Press these keys to navigate faster</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Category Filter */}
          <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            <div className="flex items-center gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
                    selectedCategory === category
                      ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Shortcuts List */}
          <div className="max-h-[60vh] overflow-y-auto p-6">
            {Object.entries(groupedShortcuts).map(([category, items]) => (
              <div key={category} className="mb-6 last:mb-0">
                {selectedCategory === 'All' && (
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    {category}
                  </h3>
                )}
                <div className="space-y-2">
                  {items.map((shortcut, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIdx) => (
                          <kbd
                            key={keyIdx}
                            className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Command className="w-4 h-4" />
                <span>Tip: Press any key sequence quickly</span>
              </div>
              <span>{shortcuts.length} shortcuts available</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Hook for keyboard navigation
export function useKeyboardNavigation({
  itemCount,
  onSelect,
  onNext,
  onPrevious,
  enabled = true,
}: {
  itemCount: number;
  onSelect?: (index: number) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  enabled?: boolean;
}) {
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => {
            const next = prev + 1;
            if (next >= itemCount) return 0;
            return next;
          });
          onNext?.();
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => {
            const next = prev - 1;
            if (next < 0) return itemCount - 1;
            return next;
          });
          onPrevious?.();
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0) {
            onSelect?.(selectedIndex);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [itemCount, selectedIndex, onSelect, onNext, onPrevious, enabled]);

  return { selectedIndex, setSelectedIndex };
}
