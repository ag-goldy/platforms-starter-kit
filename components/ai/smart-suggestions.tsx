'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Lightbulb,
  Tag,
  User,
  Ticket,
  AlertTriangle,
  CheckCircle,
  X,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SmartSuggestion {
  id: string;
  type: 'category' | 'priority' | 'assignee' | 'merge' | 'response' | 'kb';
  confidence: number;
  title: string;
  description: string;
  action: {
    type: 'apply' | 'view' | 'suggest';
    label: string;
    data?: unknown;
  };
}

interface SmartSuggestionsProps {
  ticketId: string;
  ticketContent: {
    subject: string;
    description: string;
    category?: string;
    priority?: string;
  };
  onApplySuggestion: (suggestion: SmartSuggestion) => Promise<void>;
  className?: string;
}

export function SmartSuggestions({
  ticketId,
  ticketContent,
  onApplySuggestion,
  className,
}: SmartSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(true);

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          subject: ticketContent.subject,
          description: ticketContent.description,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (e) {
      console.error('Failed to fetch suggestions:', e);
    } finally {
      setIsLoading(false);
    }
  }, [ticketId, ticketContent]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleDismiss = (id: string) => {
    setDismissed((prev) => [...prev, id]);
  };

  const handleApply = async (suggestion: SmartSuggestion) => {
    try {
      await onApplySuggestion(suggestion);
      handleDismiss(suggestion.id);
    } catch (e) {
      console.error('Failed to apply suggestion:', e);
    }
  };

  const visibleSuggestions = suggestions.filter((s) => !dismissed.includes(s.id));

  if (visibleSuggestions.length === 0 && !isLoading) return null;

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-b"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-orange-500" />
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            AI Suggestions
          </span>
          {visibleSuggestions.length > 0 && (
            <Badge className="bg-orange-100 text-orange-700">
              {visibleSuggestions.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-orange-500" />}
          <span className="text-sm text-gray-500">
            {expanded ? 'Hide' : 'Show'}
          </span>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="divide-y"
          >
            {visibleSuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onApply={() => handleApply(suggestion)}
                onDismiss={() => handleDismiss(suggestion.id)}
              />
            ))}

            {visibleSuggestions.length === 0 && !isLoading && (
              <div className="p-4 text-center text-sm text-gray-500">
                No suggestions at this time
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onApply,
  onDismiss,
}: {
  suggestion: SmartSuggestion;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const icons = {
    category: Tag,
    priority: AlertTriangle,
    assignee: User,
    merge: Ticket,
    response: Sparkles,
    kb: Lightbulb,
  };

  const colors = {
    category: 'bg-blue-50 text-blue-600 border-blue-200',
    priority: 'bg-red-50 text-red-600 border-red-200',
    assignee: 'bg-green-50 text-green-600 border-green-200',
    merge: 'bg-purple-50 text-purple-600 border-purple-200',
    response: 'bg-orange-50 text-orange-600 border-orange-200',
    kb: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  };

  const Icon = icons[suggestion.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="p-4 flex items-start gap-3"
    >
      <div
        className={cn(
          'p-2 rounded-lg border flex-shrink-0',
          colors[suggestion.type]
        )}
      >
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">
              {suggestion.title}
            </h4>
            <p className="text-sm text-gray-500 mt-0.5">
              {suggestion.description}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <ConfidenceBar confidence={suggestion.confidence} />
            <span className="text-xs text-gray-400">
              {Math.round(suggestion.confidence * 100)}% confident
            </span>
          </div>

          <Button
            size="sm"
            variant={suggestion.action.type === 'apply' ? 'default' : 'outline'}
            onClick={onApply}
            className={cn(
              'gap-1',
              suggestion.action.type === 'apply' &&
                'bg-orange-600 hover:bg-orange-700'
            )}
          >
            {suggestion.action.label}
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  let color = 'bg-red-500';
  if (confidence > 0.7) color = 'bg-green-500';
  else if (confidence > 0.4) color = 'bg-yellow-500';

  return (
    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all', color)}
        style={{ width: `${confidence * 100}%` }}
      />
    </div>
  );
}

// Sentiment Analysis Badge
interface SentimentBadgeProps {
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;
  className?: string;
}

export function SentimentBadge({ sentiment, score, className }: SentimentBadgeProps) {
  const config = {
    positive: {
      icon: CheckCircle,
      label: 'Positive',
      color: 'bg-green-100 text-green-700 border-green-200',
    },
    neutral: {
      icon: () => <span className="w-4 h-4 rounded-full border-2 border-gray-400" />,
      label: 'Neutral',
      color: 'bg-gray-100 text-gray-700 border-gray-200',
    },
    negative: {
      icon: AlertTriangle,
      label: 'Negative',
      color: 'bg-red-100 text-red-700 border-red-200',
    },
  };

  const { icon: Icon, label, color } = config[sentiment];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border',
        color,
        className
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>
        {label} ({Math.round(score * 100)}%)
      </span>
    </div>
  );
}

// AI Response Suggestions
interface AiResponseSuggestionsProps {
  context: string;
  onSelect: (response: string) => void;
  className?: string;
}

export function AiResponseSuggestions({
  context,
  onSelect,
  className,
}: AiResponseSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const generateSuggestions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/response-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (e) {
      console.error('Failed to generate suggestions:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (context.length > 50) {
      const timeout = setTimeout(generateSuggestions, 1000);
      return () => clearTimeout(timeout);
    }
  }, [context]);

  if (suggestions.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Sparkles className="w-3 h-3" />
        <span>Suggested responses</span>
      </div>
      <div className="space-y-2">
        {suggestions.map((suggestion, i) => (
          <button
            key={i}
            onClick={() => onSelect(suggestion)}
            className="w-full text-left p-3 text-sm bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {suggestion.slice(0, 150)}
            {suggestion.length > 150 && '...'}
          </button>
        ))}
      </div>
    </div>
  );
}
