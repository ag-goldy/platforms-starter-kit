'use client';

import { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  MoreHorizontal,
  Calendar,
  User,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Subtask {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  assignee?: {
    id: string;
    name: string;
  } | null;
  dueDate?: Date;
  sortOrder: number;
}

interface SubtasksProps {
  ticketId: string;
  subtasks: Subtask[];
  currentUserId: string;
  users: Array<{ id: string; name: string }>;
  onAdd: (subtask: {
    title: string;
    description?: string;
    assigneeId?: string;
    dueDate?: Date;
  }) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Subtask>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (subtasks: Subtask[]) => Promise<void>;
  className?: string;
}

export function Subtasks({
  ticketId,
  subtasks,
  currentUserId,
  users,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
  className,
}: SubtasksProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSubtask, setNewSubtask] = useState({
    title: '',
    description: '',
    assigneeId: '',
    dueDate: '',
  });
  const [items, setItems] = useState(subtasks);

  // Update items when prop changes
  useState(() => {
    setItems(subtasks);
  });

  const handleAdd = async () => {
    if (!newSubtask.title.trim()) return;

    try {
      await onAdd({
        title: newSubtask.title,
        description: newSubtask.description,
        assigneeId: newSubtask.assigneeId || undefined,
        dueDate: newSubtask.dueDate ? new Date(newSubtask.dueDate) : undefined,
      });
      setIsAdding(false);
      setNewSubtask({ title: '', description: '', assigneeId: '', dueDate: '' });
    } catch (e) {
      console.error('Failed to add subtask:', e);
    }
  };

  const handleToggleStatus = async (subtask: Subtask) => {
    const newStatus: Subtask['status'] =
      subtask.status === 'done' ? 'todo' : subtask.status === 'todo' ? 'in_progress' : 'done';
    await onUpdate(subtask.id, { status: newStatus });
  };

  const completedCount = subtasks.filter((s) => s.status === 'done').length;
  const progress = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;

  return (
    <div className={cn('border rounded-lg p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold">Subtasks</h3>
          <span className="text-sm text-gray-500">
            ({completedCount}/{subtasks.length})
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(true)}
          disabled={isAdding}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Progress Bar */}
      {subtasks.length > 0 && (
        <div className="mb-4">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-green-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Add Subtask Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 space-y-3"
          >
            <Input
              placeholder="What needs to be done?"
              value={newSubtask.title}
              onChange={(e) => setNewSubtask({ ...newSubtask, title: e.target.value })}
              autoFocus
            />
            <Input
              placeholder="Description (optional)"
              value={newSubtask.description}
              onChange={(e) =>
                setNewSubtask({ ...newSubtask, description: e.target.value })
              }
            />
            <div className="flex gap-2">
              <select
                value={newSubtask.assigneeId}
                onChange={(e) =>
                  setNewSubtask({ ...newSubtask, assigneeId: e.target.value })
                }
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Assign to...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              <Input
                type="date"
                value={newSubtask.dueDate}
                onChange={(e) =>
                  setNewSubtask({ ...newSubtask, dueDate: e.target.value })
                }
                className="flex-1"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>
                Add Subtask
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtasks List */}
      <div className="space-y-2">
        {subtasks.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-500">
            No subtasks yet. Break down this ticket into smaller tasks.
          </div>
        ) : (
          subtasks
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((subtask) => (
              <SubtaskItem
                key={subtask.id}
                subtask={subtask}
                users={users}
                onToggle={() => handleToggleStatus(subtask)}
                onUpdate={(updates) => onUpdate(subtask.id, updates)}
                onDelete={() => onDelete(subtask.id)}
                isEditing={editingId === subtask.id}
                onStartEdit={() => setEditingId(subtask.id)}
                onCancelEdit={() => setEditingId(null)}
              />
            ))
        )}
      </div>
    </div>
  );
}

interface SubtaskItemProps {
  subtask: Subtask;
  users: Array<{ id: string; name: string }>;
  onToggle: () => void;
  onUpdate: (updates: Partial<Subtask>) => void;
  onDelete: () => void;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
}

function SubtaskItem({
  subtask,
  users,
  onToggle,
  onUpdate,
  onDelete,
  isEditing,
  onStartEdit,
  onCancelEdit,
}: SubtaskItemProps) {
  const [editValue, setEditValue] = useState(subtask.title);

  const statusIcons = {
    todo: Circle,
    in_progress: () => (
      <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    ),
    done: CheckCircle2,
  };

  const StatusIcon = statusIcons[subtask.status];

  const statusColors = {
    todo: 'text-gray-400',
    in_progress: 'text-blue-500',
    done: 'text-green-500',
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onUpdate({ title: editValue });
              onCancelEdit();
            } else if (e.key === 'Escape') {
              onCancelEdit();
            }
          }}
        />
        <Button
          size="sm"
          onClick={() => {
            onUpdate({ title: editValue });
            onCancelEdit();
          }}
        >
          Save
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      layout
      className={cn(
        'group flex items-start gap-2 p-3 rounded-lg border transition-colors',
        subtask.status === 'done'
          ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200'
          : 'bg-white dark:bg-gray-800 border-gray-200 hover:border-gray-300'
      )}
    >
      <button
        onClick={onToggle}
        className={cn('mt-0.5 transition-colors', statusColors[subtask.status])}
      >
        <StatusIcon className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'font-medium',
            subtask.status === 'done' && 'line-through text-gray-400'
          )}
          onDoubleClick={onStartEdit}
        >
          {subtask.title}
        </div>

        {subtask.description && (
          <div className="text-sm text-gray-500 mt-1">{subtask.description}</div>
        )}

        <div className="flex items-center gap-3 mt-2">
          {subtask.assignee && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <User className="w-3 h-3" />
              <Avatar className="w-4 h-4">
                <AvatarFallback className="text-[8px]">
                  {subtask.assignee.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate max-w-[100px]">{subtask.assignee.name}</span>
            </div>
          )}

          {subtask.dueDate && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Calendar className="w-3 h-3" />
              <span
                className={cn(
                  new Date(subtask.dueDate) < new Date() &&
                    subtask.status !== 'done' &&
                    'text-red-500'
                )}
              >
                {new Date(subtask.dueDate).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <select
          value={subtask.assignee?.id || ''}
          onChange={(e) =>
            onUpdate({
              assignee: e.target.value
                ? { id: e.target.value, name: users.find((u) => u.id === e.target.value)?.name || '' }
                : null,
            })
          }
          className="text-xs px-2 py-1 border rounded"
        >
          <option value="">Unassigned</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>

        <button
          onClick={onDelete}
          className="p-1.5 text-gray-400 hover:text-red-500 rounded"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
