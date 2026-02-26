'use client';

import { cn } from '@/lib/utils';

interface LoadingShellProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * Instant loading shell that shows immediately
 * Prevents layout shift while content loads
 */
export function LoadingShell({ className, children }: LoadingShellProps) {
  return (
    <div className={cn("min-h-[200px]", className)}>
      {children || <DefaultLoadingState />}
    </div>
  );
}

function DefaultLoadingState() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4" />
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
        <div className="h-4 bg-gray-200 rounded w-4/6" />
      </div>
    </div>
  );
}

/**
 * Skeleton row for tables/lists
 */
interface SkeletonRowProps {
  columns: number;
  className?: string;
}

export function SkeletonRow({ columns, className }: SkeletonRowProps) {
  return (
    <div className={cn("flex gap-4 py-3", className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <div 
          key={i} 
          className="h-4 bg-gray-200 rounded animate-pulse flex-1"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}

/**
 * Card skeleton with specific layout
 */
interface CardSkeletonProps {
  hasHeader?: boolean;
  rows?: number;
  className?: string;
}

export function CardSkeletonLayout({ 
  hasHeader = true, 
  rows = 3,
  className 
}: CardSkeletonProps) {
  return (
    <div className={cn("bg-white rounded-lg border shadow-sm overflow-hidden", className)}>
      {hasHeader && (
        <div className="p-4 border-b">
          <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse" />
        </div>
      )}
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div 
            key={i}
            className="h-4 bg-gray-200 rounded animate-pulse"
            style={{ 
              width: `${85 + Math.random() * 15}%`,
              animationDelay: `${i * 100}ms`
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Stats card skeleton
 */
export function StatsCardSkeleton() {
  return (
    <div className="bg-white p-6 rounded-lg border shadow-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
          <div className="h-8 bg-gray-200 rounded w-16 animate-pulse" />
        </div>
        <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse" />
      </div>
    </div>
  );
}

/**
 * Page header skeleton
 */
export function PageHeaderSkeleton() {
  return (
    <div className="space-y-4 mb-6">
      <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
      <div className="flex items-center justify-between">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="h-10 bg-gray-200 rounded w-24 animate-pulse" />
      </div>
    </div>
  );
}
