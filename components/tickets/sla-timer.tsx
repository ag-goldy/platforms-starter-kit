'use client';

import { useState, useEffect } from 'react';

interface SLATimerProps {
  createdAt: string;
  slaResponseHours: number;
  slaResolutionHours: number;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  status: string;
  priority: string;
}

export function SLATimer({
  createdAt,
  slaResponseHours,
  slaResolutionHours,
  firstResponseAt,
  resolvedAt,
  status,
}: SLATimerProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Pause timer when waiting on customer
    if (status === 'WAITING_ON_CUSTOMER') return;
    
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const created = new Date(createdAt);
  
  // Response SLA
  const responseDueAt = new Date(created.getTime() + slaResponseHours * 3600000);
  const responseRemaining = firstResponseAt ? null : responseDueAt.getTime() - now.getTime();
  
  // Resolution SLA
  const resolutionDueAt = new Date(created.getTime() + slaResolutionHours * 3600000);
  const resolutionRemaining = resolvedAt ? null : resolutionDueAt.getTime() - now.getTime();

  return (
    <div className="space-y-2">
      {responseRemaining !== null && (
        <SLABar
          label="Response"
          remainingMs={responseRemaining}
          totalMs={slaResponseHours * 3600000}
          paused={status === 'WAITING_ON_CUSTOMER'}
        />
      )}
      {responseRemaining === null && firstResponseAt && (
        <div className="text-xs text-green-600">✓ Response sent</div>
      )}
      
      {resolutionRemaining !== null && (
        <SLABar
          label="Resolution"
          remainingMs={resolutionRemaining}
          totalMs={slaResolutionHours * 3600000}
          paused={status === 'WAITING_ON_CUSTOMER'}
        />
      )}
      {resolutionRemaining === null && resolvedAt && (
        <div className="text-xs text-green-600">✓ Resolved</div>
      )}
    </div>
  );
}

function SLABar({ 
  label, 
  remainingMs, 
  totalMs, 
  paused 
}: {
  label: string;
  remainingMs: number;
  totalMs: number;
  paused: boolean;
}) {
  const percentRemaining = Math.max(0, (remainingMs / totalMs) * 100);
  const breached = remainingMs < 0;
  
  // Color logic: green >50%, yellow 25-50%, red <25%, flashing red if breached
  let colorClass = 'bg-green-500';
  let textClass = 'text-green-700';
  if (percentRemaining < 50) { colorClass = 'bg-yellow-500'; textClass = 'text-yellow-700'; }
  if (percentRemaining < 25) { colorClass = 'bg-red-500'; textClass = 'text-red-700'; }
  if (breached) { colorClass = 'bg-red-600 animate-pulse'; textClass = 'text-red-700 font-bold'; }

  const formatTime = (ms: number) => {
    const abs = Math.abs(ms);
    const hours = Math.floor(abs / 3600000);
    const minutes = Math.floor((abs % 3600000) / 60000);
    const seconds = Math.floor((abs % 60000) / 1000);
    const prefix = ms < 0 ? 'BREACHED: ' : '';
    const suffix = ms < 0 ? ' overdue' : ' remaining';
    if (hours > 0) return `${prefix}${hours}h ${minutes}m${suffix}`;
    if (minutes > 0) return `${prefix}${minutes}m ${seconds}s${suffix}`;
    return `${prefix}${seconds}s${suffix}`;
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-gray-500">
          {label} {paused && <span className="text-amber-600">(paused)</span>}
        </span>
        <span className={`text-xs ${textClass}`}>{formatTime(remainingMs)}</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${Math.min(100, Math.max(0, percentRemaining))}%` }}
        />
      </div>
    </div>
  );
}
