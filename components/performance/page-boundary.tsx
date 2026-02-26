'use client';

import { Suspense } from 'react';
import { DashboardSkeleton, TicketListSkeleton } from '@/components/ui/skeleton';

interface PageBoundaryProps {
  children: React.ReactNode;
  type?: 'dashboard' | 'list' | 'detail' | 'form';
  fallback?: React.ReactNode;
}

/**
 * Page boundary with appropriate skeleton for the page type
 */
export function PageBoundary({ 
  children, 
  type = 'dashboard',
  fallback 
}: PageBoundaryProps) {
  const defaultFallback = getFallbackForType(type);
  
  return (
    <Suspense fallback={fallback || defaultFallback}>
      {children}
    </Suspense>
  );
}

function getFallbackForType(type: PageBoundaryProps['type']) {
  switch (type) {
    case 'dashboard':
      return <DashboardSkeleton />;
    case 'list':
      return <TicketListSkeleton count={5} />;
    case 'detail':
      return <DetailFallback />;
    case 'form':
      return <FormFallback />;
    default:
      return <DashboardSkeleton />;
  }
}

function DetailFallback() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="h-64 bg-gray-200 rounded" />
        </div>
        <div className="space-y-4">
          <div className="h-32 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

function FormFallback() {
  return (
    <div className="space-y-6 animate-pulse max-w-2xl">
      <div className="h-8 bg-gray-200 rounded w-1/4" />
      <div className="space-y-4">
        <div className="h-10 bg-gray-200 rounded" />
        <div className="h-32 bg-gray-200 rounded" />
        <div className="h-10 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

/**
 * Async section that can load independently
 */
interface AsyncSectionProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

export function AsyncSection({ children, fallback }: AsyncSectionProps) {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
}
