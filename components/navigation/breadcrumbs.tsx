'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  showHome?: boolean;
}

export function Breadcrumbs({ items, className, showHome = true }: BreadcrumbsProps) {
  return (
    <nav 
      className={cn("flex items-center gap-1 text-sm text-gray-500", className)}
      aria-label="Breadcrumb"
    >
      {showHome && (
        <>
          <Link 
            href="/app" 
            className="flex items-center gap-1 hover:text-gray-700 transition-colors"
          >
            <Home className="h-4 w-4" />
            <span className="sr-only">Home</span>
          </Link>
          <ChevronRight className="h-4 w-4" />
        </>
      )}
      
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        return (
          <div key={index} className="flex items-center gap-1">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="flex items-center gap-1 hover:text-gray-700 transition-colors"
              >
                {item.icon && <span className="text-gray-400">{item.icon}</span>}
                <span className="truncate max-w-[150px] sm:max-w-[200px]">{item.label}</span>
              </Link>
            ) : (
              <span 
                className={cn(
                  "flex items-center gap-1 truncate max-w-[150px] sm:max-w-[250px]",
                  isLast && "font-medium text-gray-900"
                )}
                aria-current={isLast ? "page" : undefined}
              >
                {item.icon && <span className="text-gray-400">{item.icon}</span>}
                {item.label}
              </span>
            )}
            
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </div>
        );
      })}
    </nav>
  );
}

// Page header with breadcrumbs and actions
interface PageHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ 
  breadcrumbs, 
  title, 
  description, 
  actions,
  className 
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-4 pb-6", className)}>
      {breadcrumbs && (
        <Breadcrumbs items={breadcrumbs} />
      )}
      
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
        </div>
        
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

// Sticky header for lists
interface StickyHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function StickyHeader({ children, className }: StickyHeaderProps) {
  return (
    <div 
      className={cn(
        "sticky top-0 z-10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60",
        "border-b pb-4 mb-4",
        className
      )}
    >
      {children}
    </div>
  );
}
