'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SmartLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  exact?: boolean;
  onClick?: () => void;
}

/**
 * Smart Link that:
 * 1. Prevents navigation when already on the target page (no reload)
 * 2. Shows active state styling
 * 3. Scrolls to top when navigating to same page intentionally
 */
export function SmartLink({
  href,
  children,
  className,
  activeClassName,
  exact = false,
  onClick,
}: SmartLinkProps) {
  const pathname = usePathname();
  const isActive = exact 
    ? pathname === href 
    : pathname === href || pathname?.startsWith(href + '/');
  
  const handleClick = (e: React.MouseEvent) => {
    // If already on this page, prevent navigation
    if (isActive) {
      e.preventDefault();
      // Optional: scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    onClick?.();
  };

  return (
    <Link
      href={href}
      className={cn(className, isActive && activeClassName)}
      onClick={handleClick}
      scroll={false}
    >
      {children}
    </Link>
  );
}

/**
 * Navigation link for top-level nav items
 */
interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
}

export function NavLink({ href, children, exact = false }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href || pathname === href + '/'
    : pathname?.startsWith(href);

  return (
    <SmartLink
      href={href}
      exact={exact}
      className={`px-3 py-2 text-sm rounded-md transition-colors ${
        isActive
          ? 'bg-gray-100 text-gray-900 font-medium'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      {children}
    </SmartLink>
  );
}
