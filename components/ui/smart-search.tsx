'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Clock, FileText, User, BookOpen, Server, Command, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './input';

interface SearchSuggestion {
  id: string;
  type: 'ticket' | 'kb' | 'user' | 'asset' | 'command' | 'recent';
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

interface SmartSearchProps {
  className?: string;
  placeholder?: string;
  onSearch?: (query: string) => void;
  suggestions?: SearchSuggestion[];
  loading?: boolean;
  showRecent?: boolean;
  showCommands?: boolean;
  shortcut?: string;
}

// Default suggestions/commands
const defaultCommands: SearchSuggestion[] = [
  { id: 'cmd-new-ticket', type: 'command', title: 'Create New Ticket', icon: <Ticket className="h-4 w-4" />, href: '/app/tickets/new' },
  { id: 'cmd-my-tickets', type: 'command', title: 'My Open Tickets', icon: <FileText className="h-4 w-4" />, href: '/app/tickets?assignee=me' },
  { id: 'cmd-kb', type: 'command', title: 'Browse Knowledge Base', icon: <BookOpen className="h-4 w-4" />, href: '/app/kb' },
  { id: 'cmd-assets', type: 'command', title: 'View Assets', icon: <Server className="h-4 w-4" />, href: '/app/assets' },
];

export function SmartSearch({
  className,
  placeholder = 'Search tickets, KB articles, users...',
  onSearch,
  suggestions = [],
  loading = false,
  showRecent = true,
  showCommands = true,
  shortcut = '/',
}: SmartSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Save recent search
  const saveRecentSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  }, [recentSearches]);

  // Keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === shortcut && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcut]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Generate filtered suggestions
  const filteredSuggestions = React.useMemo(() => {
    if (!query.trim()) {
      const items: SearchSuggestion[] = [];
      
      if (showRecent && recentSearches.length > 0) {
        items.push(...recentSearches.map((term, i) => ({
          id: `recent-${i}`,
          type: 'recent' as const,
          title: term,
          icon: <Clock className="h-4 w-4 text-gray-400" />,
          onClick: () => {
            setQuery(term);
            onSearch?.(term);
            saveRecentSearch(term);
          },
        })));
      }
      
      if (showCommands) {
        items.push(...defaultCommands);
      }
      
      return items;
    }

    // Filter provided suggestions
    const lowerQuery = query.toLowerCase();
    return suggestions.filter(s => 
      s.title.toLowerCase().includes(lowerQuery) ||
      s.subtitle?.toLowerCase().includes(lowerQuery)
    );
  }, [query, suggestions, recentSearches, showRecent, showCommands, onSearch, saveRecentSearch]);

  // Handle selection
  const handleSelect = (suggestion: SearchSuggestion) => {
    if (suggestion.onClick) {
      suggestion.onClick();
    } else if (suggestion.href) {
      saveRecentSearch(query);
    }
    setIsOpen(false);
    setQuery('');
  };

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch?.(query);
      saveRecentSearch(query);
      setIsOpen(false);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % filteredSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + filteredSuggestions.length) % filteredSuggestions.length);
    } else if (e.key === 'Enter' && filteredSuggestions[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredSuggestions[selectedIndex]);
    }
  };

  const getIcon = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'ticket': return <Ticket className="h-4 w-4 text-blue-500" />;
      case 'kb': return <BookOpen className="h-4 w-4 text-green-500" />;
      case 'user': return <User className="h-4 w-4 text-purple-500" />;
      case 'asset': return <Server className="h-4 w-4 text-orange-500" />;
      case 'command': return <Command className="h-4 w-4 text-gray-500" />;
      case 'recent': return <Clock className="h-4 w-4 text-gray-400" />;
      default: return <Search className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-10 pr-10"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        ) : shortcut && (
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 border rounded px-1.5 py-0.5">
            {shortcut}
          </kbd>
        )}
      </form>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-[400px] overflow-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-gray-600 rounded-full mx-auto mb-2" />
              Searching...
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No results found
            </div>
          ) : (
            <div className="py-2">
              {filteredSuggestions.map((suggestion, index) => (
                <div
                  key={suggestion.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors",
                    index === selectedIndex && "bg-gray-100",
                    "hover:bg-gray-50"
                  )}
                  onClick={() => handleSelect(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="text-gray-400">
                    {suggestion.icon || getIcon(suggestion.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {suggestion.title}
                    </p>
                    {suggestion.subtitle && (
                      <p className="text-xs text-gray-500 truncate">
                        {suggestion.subtitle}
                      </p>
                    )}
                  </div>
                  {suggestion.href && (
                    <span className="text-xs text-gray-400">Return</span>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Footer */}
          <div className="border-t px-4 py-2 text-xs text-gray-400 flex items-center justify-between">
            <span>
              <kbd className="border rounded px-1">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="border rounded px-1">Return</kbd> Select
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline search for tables/lists
export function InlineSearch({
  value,
  onChange,
  placeholder = 'Search...',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-8 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
