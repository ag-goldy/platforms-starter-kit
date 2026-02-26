'use client';

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Search,
  X,
  Ticket,
  User,
  Settings,
  FileText,
  Home,
  LogOut,
  Plus,
  ChevronRight,
  Clock,
  Tag,
  Building,
  BookOpen,
  BarChart3,
  Bell,
  Command,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category: string;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  user?: {
    id: string;
    name?: string | null;
    email: string;
    isInternal: boolean;
  } | null;
}

export function CommandPalette({ isOpen, onClose, user }: CommandPaletteProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load recent commands from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentCommands');
    if (saved) {
      setRecentCommands(JSON.parse(saved));
    }
  }, []);

  // Save recent command
  const saveRecentCommand = useCallback((commandId: string) => {
    setRecentCommands((prev) => {
      const updated = [commandId, ...prev.filter((id) => id !== commandId)].slice(0, 5);
      localStorage.setItem('recentCommands', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Build command list
  const commands: CommandItem[] = [
    // Navigation
    {
      id: 'home',
      title: 'Go to Dashboard',
      subtitle: 'View main dashboard',
      icon: <Home className="w-4 h-4" />,
      shortcut: 'G D',
      action: () => router.push('/app'),
      category: 'Navigation',
      keywords: ['dashboard', 'home', 'main'],
    },
    {
      id: 'tickets',
      title: 'View Tickets',
      subtitle: 'Browse all tickets',
      icon: <Ticket className="w-4 h-4" />,
      shortcut: 'G T',
      action: () => router.push('/app/tickets'),
      category: 'Navigation',
      keywords: ['tickets', 'issues', 'cases'],
    },
    {
      id: 'new-ticket',
      title: 'Create New Ticket',
      subtitle: 'Create a support ticket',
      icon: <Plus className="w-4 h-4" />,
      shortcut: 'C T',
      action: () => router.push('/app/tickets/new'),
      category: 'Actions',
      keywords: ['create', 'new', 'ticket'],
    },
    {
      id: 'users',
      title: 'Manage Users',
      subtitle: 'View and manage users',
      icon: <User className="w-4 h-4" />,
      shortcut: 'G U',
      action: () => router.push('/app/users'),
      category: 'Navigation',
      keywords: ['users', 'people', 'customers'],
    },
    {
      id: 'organizations',
      title: 'Organizations',
      subtitle: 'Manage organizations',
      icon: <Building className="w-4 h-4" />,
      shortcut: 'G O',
      action: () => router.push('/app/organizations'),
      category: 'Navigation',
      keywords: ['orgs', 'companies', 'organizations'],
    },
    {
      id: 'kb',
      title: 'Knowledge Base',
      subtitle: 'Browse articles',
      icon: <BookOpen className="w-4 h-4" />,
      shortcut: 'G K',
      action: () => router.push('/app/kb'),
      category: 'Navigation',
      keywords: ['kb', 'articles', 'docs', 'help'],
    },
    {
      id: 'templates',
      title: 'Templates',
      subtitle: 'Manage ticket templates',
      icon: <FileText className="w-4 h-4" />,
      action: () => router.push('/app/templates'),
      category: 'Navigation',
      keywords: ['templates', 'canned', 'responses'],
    },
    {
      id: 'tags',
      title: 'Tags',
      subtitle: 'Manage ticket tags',
      icon: <Tag className="w-4 h-4" />,
      action: () => router.push('/app/tags'),
      category: 'Navigation',
      keywords: ['tags', 'labels', 'categories'],
    },
    {
      id: 'reports',
      title: 'Reports',
      subtitle: 'View analytics and reports',
      icon: <BarChart3 className="w-4 h-4" />,
      action: () => router.push('/app/reports'),
      category: 'Navigation',
      keywords: ['reports', 'analytics', 'stats', 'metrics'],
    },
    {
      id: 'sla',
      title: 'SLA Policies',
      subtitle: 'Manage service level agreements',
      icon: <Clock className="w-4 h-4" />,
      action: () => router.push('/app/sla'),
      category: 'Navigation',
      keywords: ['sla', 'policies', 'agreements'],
    },
    {
      id: 'settings',
      title: 'Settings',
      subtitle: 'Application settings',
      icon: <Settings className="w-4 h-4" />,
      shortcut: 'G S',
      action: () => router.push('/app/settings/security'),
      category: 'Navigation',
      keywords: ['settings', 'preferences', 'config'],
    },
    {
      id: 'notifications',
      title: 'Notifications',
      subtitle: 'View notifications',
      icon: <Bell className="w-4 h-4" />,
      shortcut: 'G N',
      action: () => router.push('/app/notifications'),
      category: 'Navigation',
      keywords: ['notifications', 'alerts', 'messages'],
    },
    {
      id: 'ask-ai',
      title: 'Ask Zeus AI',
      subtitle: 'Get AI-powered assistance',
      icon: <Sparkles className="w-4 h-4" />,
      shortcut: '⌘ K',
      action: () => {
        // Trigger AI chat
        window.dispatchEvent(new CustomEvent('open-ai-chat'));
      },
      category: 'AI & Help',
      keywords: ['ai', 'help', 'assist', 'zeus'],
    },
    {
      id: 'shortcuts',
      title: 'Keyboard Shortcuts',
      subtitle: 'View all keyboard shortcuts',
      icon: <Command className="w-4 h-4" />,
      shortcut: '?',
      action: () => {
        window.dispatchEvent(new CustomEvent('show-shortcuts-help'));
      },
      category: 'Help',
      keywords: ['shortcuts', 'keyboard', 'help', 'hotkeys'],
    },
    {
      id: 'logout',
      title: 'Sign Out',
      subtitle: 'Log out of your account',
      icon: <LogOut className="w-4 h-4" />,
      action: () => {
        fetch('/api/auth/signout', { method: 'POST' }).then(() => {
          window.location.href = '/login';
        });
      },
      category: 'Account',
      keywords: ['logout', 'signout', 'exit'],
    },
  ];

  // Filter commands based on search
  const filteredCommands = commands.filter((cmd) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(query) ||
      cmd.subtitle?.toLowerCase().includes(query) ||
      cmd.category.toLowerCase().includes(query) ||
      cmd.keywords?.some((k) => k.toLowerCase().includes(query))
    );
  });

  // Group by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  // Flatten for keyboard navigation
  const flatCommands = Object.values(groupedCommands).flat();

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % flatCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + flatCommands.length) % flatCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = flatCommands[selectedIndex];
        if (selected) {
          saveRecentCommand(selected.id);
          selected.action();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatCommands, selectedIndex, onClose, saveRecentCommand]);

  // Scroll selected into view
  useEffect(() => {
    const element = document.getElementById(`command-${selectedIndex}`);
    element?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[20vh]"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200 dark:border-gray-700">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a command or search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
            <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 rounded">
              ESC
            </kbd>
          </div>

          {/* Command List */}
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
            {flatCommands.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                No commands found for &quot;{searchQuery}&quot;
              </div>
            ) : (
              Object.entries(groupedCommands).map(([category, items]) => (
                <div key={category}>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {category}
                  </div>
                  {items.map((cmd, idx) => {
                    const globalIndex = flatCommands.findIndex((c) => c.id === cmd.id);
                    const isSelected = globalIndex === selectedIndex;

                    return (
                      <button
                        key={cmd.id}
                        id={`command-${globalIndex}`}
                        onClick={() => {
                          saveRecentCommand(cmd.id);
                          cmd.action();
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={cn(
                          'w-full px-4 py-3 flex items-center gap-3 transition-colors',
                          isSelected
                            ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-900 dark:text-orange-100'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        )}
                      >
                        <div
                          className={cn(
                            'p-2 rounded-lg',
                            isSelected
                              ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                          )}
                        >
                          {cmd.icon}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-medium">{cmd.title}</div>
                          {cmd.subtitle && (
                            <div className="text-sm text-gray-500">{cmd.subtitle}</div>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <div className="flex items-center gap-1">
                            {cmd.shortcut.split(' ').map((key, i) => (
                              <kbd
                                key={i}
                                className={cn(
                                  'px-2 py-1 text-xs font-mono rounded',
                                  isSelected
                                    ? 'bg-orange-200 dark:bg-orange-800'
                                    : 'bg-gray-100 dark:bg-gray-800'
                                )}
                              >
                                {key}
                              </kbd>
                            ))}
                          </div>
                        )}
                        {isSelected && <ChevronRight className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">↑↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">↵</kbd>
                to select
              </span>
            </div>
            <span>{flatCommands.length} commands</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Hook to manage command palette
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { isOpen, setIsOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) };
}

// Global provider wrapper
interface GlobalCommandPaletteContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const GlobalCommandPaletteContext = createContext<GlobalCommandPaletteContextType | undefined>(undefined);

export function GlobalCommandPalette({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <GlobalCommandPaletteContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
      <CommandPalette isOpen={isOpen} onClose={close} />
    </GlobalCommandPaletteContext.Provider>
  );
}

export function useGlobalCommandPalette() {
  const context = useContext(GlobalCommandPaletteContext);
  if (!context) {
    throw new Error('useGlobalCommandPalette must be used within GlobalCommandPalette');
  }
  return context;
}
