'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Ticket, BookOpen, Users, Plus, Command, ArrowRight, Clock, FileText, X } from 'lucide-react';
import { useCustomerPortal } from '@/components/customer/CustomerPortalContext';
import { useHotkeys } from '@/hooks/use-hotkeys';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface CommandBarProps {
  subdomain: string;
  org: any;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string;
  category: 'tickets' | 'articles' | 'people' | 'actions' | 'recent';
  action: () => void;
}

export function CommandBar({ subdomain, org }: CommandBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openSlideOver } = useCustomerPortal();

  // Toggle command palette with Cmd+K or /
  useHotkeys('cmd+k', () => setIsOpen(true));
  useHotkeys('/', () => setIsOpen(true));

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape, { capture: true });
    }

    return () => {
      document.removeEventListener('keydown', handleEscape, { capture: true });
    };
  }, [isOpen]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Build command items
  const commands: CommandItem[] = [
    // Actions
    {
      id: 'new-ticket',
      title: 'Create New Ticket',
      subtitle: 'Submit a new support request',
      icon: <Plus className="w-4 h-4" />,
      shortcut: 'C',
      category: 'actions',
      action: () => {
        openSlideOver('ticket', { mode: 'create' });
        setIsOpen(false);
      },
    },
    {
      id: 'invite-user',
      title: 'Invite Team Member',
      subtitle: 'Add someone to your organization',
      icon: <Users className="w-4 h-4" />,
      category: 'actions',
      action: () => {
        openSlideOver('team', { mode: 'invite' });
        setIsOpen(false);
      },
    },
    // Navigation
    {
      id: 'view-tickets',
      title: 'View All Tickets',
      subtitle: 'See your ticket history',
      icon: <Ticket className="w-4 h-4" />,
      shortcut: 'T',
      category: 'tickets',
      action: () => {
        const targetUrl = `/s/${subdomain}?view=tickets`;
        const currentView = searchParams.get('view');
        if (currentView !== 'tickets') {
          router.push(targetUrl);
        }
        setIsOpen(false);
      },
    },
    {
      id: 'view-kb',
      title: 'Browse Knowledge Base',
      subtitle: 'Find answers in articles',
      icon: <BookOpen className="w-4 h-4" />,
      category: 'articles',
      action: () => {
        const targetUrl = `/s/${subdomain}?view=kb`;
        const currentView = searchParams.get('view');
        if (currentView !== 'kb') {
          router.push(targetUrl);
        }
        setIsOpen(false);
      },
    },
    {
      id: 'view-team',
      title: 'Team Directory',
      subtitle: 'Manage organization members',
      icon: <Users className="w-4 h-4" />,
      category: 'people',
      action: () => {
        console.log('CommandBar: Opening team slide-over');
        openSlideOver('team');
        setIsOpen(false);
      },
    },
  ];

  // Filter commands based on query
  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(query.toLowerCase()) ||
      cmd.subtitle?.toLowerCase().includes(query.toLowerCase())
  );

  // Group by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const flatCommands = filteredCommands;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % flatCommands.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + flatCommands.length) % flatCommands.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (flatCommands[selectedIndex]) {
            flatCommands[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(false);
          break;
      }
    },
    [filteredCommands, selectedIndex]
  );

  const categoryLabels: Record<string, string> = {
    actions: 'Actions',
    tickets: 'Tickets',
    articles: 'Knowledge Base',
    people: 'People',
    recent: 'Recent',
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-3 px-4 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 transition-colors text-left group"
      >
        <Search className="w-4 h-4 text-stone-400 group-hover:text-stone-600" />
        <span className="flex-1 text-sm text-stone-500">Search or jump to...</span>
        <kbd className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded bg-white text-xs font-medium text-stone-400 border border-stone-200">
          <Command className="w-3 h-3" />
          <span>K</span>
        </kbd>
      </button>

      {/* Command Palette Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
              onClick={() => setIsOpen(false)}
            />

            {/* Modal */}
            <motion.div
              ref={modalRef}
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="fixed inset-x-4 top-[20%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-2xl bg-surface-elevated rounded-xl shadow-2xl border border-stone-200 z-50 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-4 border-b border-stone-100">
                <Search className="w-5 h-5 text-stone-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search tickets, articles, people..."
                  className="flex-1 bg-transparent text-base outline-none placeholder:text-stone-400"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="p-1 hover:bg-stone-100 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-stone-400" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-2 py-1 text-xs text-stone-400 hover:text-stone-600 border border-stone-200 rounded"
                >
                  ESC
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto py-2">
                {filteredCommands.length === 0 ? (
                  <div className="px-4 py-8 text-center text-stone-500">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No results found</p>
                  </div>
                ) : (
                  Object.entries(groupedCommands).map(([category, items]) => (
                    <div key={category} className="px-2">
                      <div className="px-3 py-2 text-xs font-semibold text-stone-400 uppercase tracking-wider">
                        {categoryLabels[category]}
                      </div>
                      <div className="space-y-1">
                        {items.map((item, index) => {
                          const globalIndex = filteredCommands.findIndex((c) => c.id === item.id);
                          const isSelected = globalIndex === selectedIndex;

                          return (
                            <button
                              key={item.id}
                              onClick={item.action}
                              onMouseEnter={() => setSelectedIndex(globalIndex)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                                isSelected
                                  ? 'bg-brand-500 text-white'
                                  : 'hover:bg-stone-100 text-stone-700'
                              }`}
                            >
                              <span
                                className={`${isSelected ? 'text-white' : 'text-stone-400'}`}
                              >
                                {item.icon}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{item.title}</div>
                                {item.subtitle && (
                                  <div
                                    className={`text-xs truncate ${
                                      isSelected ? 'text-white/70' : 'text-stone-500'
                                    }`}
                                  >
                                    {item.subtitle}
                                  </div>
                                )}
                              </div>
                              {item.shortcut && (
                                <kbd
                                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    isSelected
                                      ? 'bg-white/20 text-white'
                                      : 'bg-stone-100 text-stone-500'
                                  }`}
                                >
                                  {item.shortcut}
                                </kbd>
                              )}
                              <ArrowRight
                                className={`w-4 h-4 ${
                                  isSelected ? 'text-white' : 'text-stone-300'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 bg-stone-50 border-t border-stone-100 text-xs text-stone-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white border border-stone-200">
                      ↑↓
                    </kbd>{' '}
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white border border-stone-200">
                      ↵
                    </kbd>{' '}
                    Select
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-stone-200">esc</kbd>{' '}
                  Close
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
