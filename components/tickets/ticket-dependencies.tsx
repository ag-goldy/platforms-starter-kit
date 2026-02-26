'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch,
  Plus,
  Trash2,
  ArrowRight,
  Link2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Dependency {
  id: string;
  ticketId: string;
  dependsOnTicketId: string;
  dependencyType: 'blocks' | 'blocked_by' | 'relates_to';
  ticket: {
    id: string;
    key: string;
    subject: string;
    status: string;
  };
}

interface TicketDependenciesProps {
  ticketId: string;
  dependencies: Dependency[];
  blockedBy: Dependency[];
  related: Dependency[];
  availableTickets: Array<{
    id: string;
    key: string;
    subject: string;
    status: string;
  }>;
  onAdd: (dependsOnTicketId: string, type: 'blocks' | 'blocked_by' | 'relates_to') => Promise<void>;
  onRemove: (dependencyId: string) => Promise<void>;
  className?: string;
}

export function TicketDependencies({
  ticketId,
  dependencies,
  blockedBy,
  related,
  availableTickets,
  onAdd,
  onRemove,
  className,
}: TicketDependenciesProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [dependencyType, setDependencyType] = useState<'blocks' | 'blocked_by' | 'relates_to'>('relates_to');

  const handleAdd = async () => {
    if (!selectedTicketId) return;
    try {
      await onAdd(selectedTicketId, dependencyType);
      setIsAdding(false);
      setSelectedTicketId('');
      setDependencyType('relates_to');
    } catch (e) {
      console.error('Failed to add dependency:', e);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW':
        return 'bg-blue-100 text-blue-800';
      case 'OPEN':
        return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800';
      case 'RESOLVED':
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={cn('border rounded-lg p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold">Dependencies</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(true)}
          disabled={isAdding}
        >
          <Plus className="w-4 h-4 mr-1" />
          Link
        </Button>
      </div>

      {/* Blocked Warning */}
      {blockedBy.some((d) => !['RESOLVED', 'CLOSED'].includes(d.ticket.status)) && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-sm text-red-800 dark:text-red-200">
            This ticket is blocked by unresolved dependencies
          </span>
        </div>
      )}

      {/* Add Dependency Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 space-y-3"
          >
            <select
              value={dependencyType}
              onChange={(e) => setDependencyType(e.target.value as typeof dependencyType)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="relates_to">Relates to</option>
              <option value="blocks">Is blocked by</option>
              <option value="blocked_by">Blocks</option>
            </select>

            <select
              value={selectedTicketId}
              onChange={(e) => setSelectedTicketId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">Select a ticket...</option>
              {availableTickets
                .filter((t) => t.id !== ticketId)
                .map((ticket) => (
                  <option key={ticket.id} value={ticket.id}>
                    {ticket.key} - {ticket.subject.slice(0, 50)}
                    {ticket.subject.length > 50 ? '...' : ''}
                  </option>
                ))}
            </select>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={!selectedTicketId}>
                Add Link
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dependencies Lists */}
      <div className="space-y-4">
        {/* Blocked By */}
        {blockedBy.length > 0 && (
          <DependencySection
            title="Blocked By"
            icon={<AlertCircle className="w-4 h-4 text-red-500" />}
            dependencies={blockedBy}
            getStatusColor={getStatusColor}
            onRemove={onRemove}
            showWarning
          />
        )}

        {/* Blocks */}
        {dependencies.length > 0 && (
          <DependencySection
            title="Blocks"
            icon={<ArrowRight className="w-4 h-4 text-orange-500" />}
            dependencies={dependencies}
            getStatusColor={getStatusColor}
            onRemove={onRemove}
          />
        )}

        {/* Related */}
        {related.length > 0 && (
          <DependencySection
            title="Related"
            icon={<Link2 className="w-4 h-4 text-blue-500" />}
            dependencies={related}
            getStatusColor={getStatusColor}
            onRemove={onRemove}
          />
        )}

        {dependencies.length === 0 && blockedBy.length === 0 && related.length === 0 && (
          <div className="text-center py-6 text-sm text-gray-500">
            No dependencies linked to this ticket
          </div>
        )}
      </div>
    </div>
  );
}

interface DependencySectionProps {
  title: string;
  icon: React.ReactNode;
  dependencies: Dependency[];
  getStatusColor: (status: string) => string;
  onRemove: (id: string) => void;
  showWarning?: boolean;
}

function DependencySection({
  title,
  icon,
  dependencies,
  getStatusColor,
  onRemove,
  showWarning,
}: DependencySectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {icon}
        {title}
        <span className="text-gray-400">({dependencies.length})</span>
      </div>
      <div className="space-y-2">
        {dependencies.map((dep) => (
          <motion.div
            key={dep.id}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              'group flex items-center gap-3 p-3 rounded-lg border transition-colors',
              showWarning && !['RESOLVED', 'CLOSED'].includes(dep.ticket.status)
                ? 'bg-red-50 dark:bg-red-900/10 border-red-200'
                : 'bg-gray-50 dark:bg-gray-800 border-gray-200'
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium text-gray-900">
                  {dep.ticket.key}
                </span>
                <Badge className={cn('text-xs', getStatusColor(dep.ticket.status))}>
                  {dep.ticket.status}
                </Badge>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {dep.ticket.subject}
              </div>
            </div>

            {['RESOLVED', 'CLOSED'].includes(dep.ticket.status) && (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            )}

            <button
              onClick={() => onRemove(dep.id)}
              className="p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Circular dependency warning
export function CircularDependencyWarning({ tickets }: { tickets: Array<{ key: string; subject: string }> }) {
  return (
    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
        <div>
          <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
            Circular Dependency Detected
          </h4>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            These tickets form a circular dependency chain:
          </p>
          <div className="mt-2 space-y-1">
            {tickets.map((ticket, i) => (
              <div key={ticket.key} className="flex items-center gap-2 text-sm">
                <span className="font-mono">{ticket.key}</span>
                <span className="text-gray-500">{ticket.subject.slice(0, 40)}...</span>
                {i < tickets.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
