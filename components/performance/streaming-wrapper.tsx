'use client';

import { Suspense } from 'react';
import { CardSkeleton } from '@/components/ui/skeleton';

interface StreamingWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Wrapper for streaming server components
 * Shows fallback UI while server components load
 */
export function StreamingWrapper({ 
  children, 
  fallback = <CardSkeleton /> 
}: StreamingWrapperProps) {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
}

/**
 * Section wrapper for progressive loading
 */
export function StreamingSection({ 
  children, 
  fallback 
}: StreamingWrapperProps) {
  return (
    <Suspense fallback={fallback || <SectionFallback />}>
      {children}
    </Suspense>
  );
}

function SectionFallback() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
      <div className="h-4 bg-gray-200 rounded w-full" />
    </div>
  );
}
