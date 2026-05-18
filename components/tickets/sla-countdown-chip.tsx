'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

export function SLACountdownChip({
  dueAt,
  type,
  breachedAt,
}: {
  dueAt?: Date | null;
  type: 'Response' | 'Resolution';
  breachedAt?: Date | null;
}) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isBreached, setIsBreached] = useState(false);
  const [isWarning, setIsWarning] = useState(false);

  useEffect(() => {
    if (!dueAt) return;

    const updateTimer = () => {
      if (breachedAt) {
        setIsBreached(true);
        setTimeLeft('Breached');
        return;
      }

      const now = new Date();
      const due = new Date(dueAt);
      
      if (now >= due) {
        setIsBreached(true);
        setTimeLeft('Breached');
      } else {
        const hoursLeft = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
        setIsWarning(hoursLeft <= 1); // Warn if < 1 hour left
        setTimeLeft(formatDistanceToNow(due, { addSuffix: true }));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // update every minute
    return () => clearInterval(interval);
  }, [dueAt, breachedAt]);

  if (!dueAt) return null;

  let colorClass = 'bg-muted text-muted-foreground border';
  if (isBreached) {
    colorClass = 'bg-destructive/10 text-destructive border-destructive/20';
  } else if (isWarning) {
    colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
  }

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}>
      {type}: {timeLeft}
    </span>
  );
}
