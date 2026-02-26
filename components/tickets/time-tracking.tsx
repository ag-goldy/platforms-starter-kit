'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Play, Pause, Plus, Trash2, DollarSign, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/utils/date';

interface TimeEntry {
  id: string;
  startedAt: Date;
  endedAt?: Date;
  durationMinutes?: number;
  description?: string;
  isBillable: boolean;
  hourlyRate?: number;
  user: {
    id: string;
    name: string;
  };
}

interface TimeTrackingProps {
  ticketId: string;
  entries: TimeEntry[];
  currentUserId: string;
  onAddEntry: (entry: {
    durationMinutes: number;
    description: string;
    isBillable: boolean;
  }) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onStartTimer: () => Promise<void>;
  onStopTimer: () => Promise<void>;
  activeTimer?: {
    id: string;
    startedAt: Date;
    description?: string;
  } | null;
  className?: string;
}

export function TimeTracking({
  ticketId,
  entries,
  currentUserId,
  onAddEntry,
  onDeleteEntry,
  onStartTimer,
  onStopTimer,
  activeTimer,
  className,
}: TimeTrackingProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(!!activeTimer);
  const [elapsed, setElapsed] = useState(0);
  const [newEntry, setNewEntry] = useState({
    hours: '',
    minutes: '',
    description: '',
    isBillable: true,
  });

  // Update timer display
  useEffect(() => {
    if (!activeTimer) {
      setIsTimerRunning(false);
      setElapsed(0);
      return;
    }

    setIsTimerRunning(true);
    const interval = setInterval(() => {
      const elapsed = Date.now() - new Date(activeTimer.startedAt).getTime();
      setElapsed(Math.floor(elapsed / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer]);

  const handleStartTimer = async () => {
    try {
      await onStartTimer();
      setIsTimerRunning(true);
    } catch (e) {
      console.error('Failed to start timer:', e);
    }
  };

  const handleStopTimer = async () => {
    try {
      await onStopTimer();
      setIsTimerRunning(false);
      setElapsed(0);
    } catch (e) {
      console.error('Failed to stop timer:', e);
    }
  };

  const handleAddEntry = async () => {
    const hours = parseInt(newEntry.hours) || 0;
    const minutes = parseInt(newEntry.minutes) || 0;
    const totalMinutes = hours * 60 + minutes;

    if (totalMinutes === 0) return;

    try {
      await onAddEntry({
        durationMinutes: totalMinutes,
        description: newEntry.description,
        isBillable: newEntry.isBillable,
      });
      setIsAdding(false);
      setNewEntry({ hours: '', minutes: '', description: '', isBillable: true });
    } catch (e) {
      console.error('Failed to add entry:', e);
    }
  };

  const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
  const billableMinutes = entries
    .filter((e) => e.isBillable)
    .reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

  return (
    <div className={cn('border rounded-lg p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold">Time Tracking</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isTimerRunning ? 'destructive' : 'default'}
            size="sm"
            onClick={isTimerRunning ? handleStopTimer : handleStartTimer}
            className={cn(
              'gap-2',
              isTimerRunning && 'bg-red-600 hover:bg-red-700'
            )}
          >
            {isTimerRunning ? (
              <>
                <Pause className="w-4 h-4" />
                <TimerDisplay seconds={elapsed} />
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Timer
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div>
          <div className="text-xs text-gray-500">Total Time</div>
          <div className="text-lg font-semibold">{formatDuration(totalMinutes)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Billable</div>
          <div className="text-lg font-semibold text-green-600">
            {formatDuration(billableMinutes)}
          </div>
        </div>
      </div>

      {/* Add Entry Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 border rounded-lg space-y-3"
          >
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500">Hours</label>
                <Input
                  type="number"
                  min="0"
                  value={newEntry.hours}
                  onChange={(e) => setNewEntry({ ...newEntry, hours: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500">Minutes</label>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={newEntry.minutes}
                  onChange={(e) => setNewEntry({ ...newEntry, minutes: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Description (optional)</label>
              <Input
                value={newEntry.description}
                onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                placeholder="What did you work on?"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="billable"
                checked={newEntry.isBillable}
                onChange={(e) => setNewEntry({ ...newEntry, isBillable: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="billable" className="text-sm flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Billable
              </label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddEntry}>
                Add Entry
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entries List */}
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-500">
            No time entries yet
          </div>
        ) : (
          entries.map((entry) => (
            <motion.div
              key={entry.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {formatDuration(entry.durationMinutes || 0)}
                  </span>
                  {entry.isBillable && (
                    <DollarSign className="w-3 h-3 text-green-500" />
                  )}
                </div>
                {entry.description && (
                  <div className="text-sm text-gray-500 truncate">{entry.description}</div>
                )}
                <div className="text-xs text-gray-400">
                  {entry.user.name} • {new Date(entry.startedAt).toLocaleDateString()}
                </div>
              </div>
              {entry.user.id === currentUserId && (
                <button
                  onClick={() => onDeleteEntry(entry.id)}
                  className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

function TimerDisplay({ seconds }: { seconds: number }) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return (
    <span className="font-mono">
      {hours.toString().padStart(2, '0')}:
      {minutes.toString().padStart(2, '0')}:
      {secs.toString().padStart(2, '0')}
    </span>
  );
}
