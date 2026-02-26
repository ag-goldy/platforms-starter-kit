import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface FastLayoutProps {
  header: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  headerFallback?: React.ReactNode;
}

/**
 * Fast layout that streams content progressively
 * Header loads first, then sidebar, then main content
 */
export function FastLayout({ 
  header, 
  sidebar,
  children,
  headerFallback
}: FastLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header loads immediately with suspense */}
      <Suspense fallback={headerFallback || <HeaderSkeleton />}>
        {header}
      </Suspense>
      
      <div className="flex">
        {/* Sidebar streams in */}
        {sidebar && (
          <aside className="w-64 hidden lg:block">
            <Suspense fallback={<SidebarSkeleton />}>
              {sidebar}
            </Suspense>
          </aside>
        )}
        
        {/* Main content streams independently */}
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <nav className="border-b bg-white h-14">
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-24 hidden md:block" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
    </nav>
  );
}

function SidebarSkeleton() {
  return (
    <div className="h-full border-r bg-white p-4 space-y-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

/**
 * Streaming card container
 */
interface StreamingCardProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function StreamingCard({ title, children, action }: StreamingCardProps) {
  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-4">
        <Suspense fallback={<CardContentSkeleton />}>
          {children}
        </Suspense>
      </div>
    </div>
  );
}

function CardContentSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-full" />
      <div className="h-4 bg-gray-200 rounded w-5/6" />
      <div className="h-4 bg-gray-200 rounded w-4/6" />
    </div>
  );
}
