'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ComponentProps } from 'react';

interface NavLinkProps extends ComponentProps<typeof Link> {
  exact?: boolean;
}

export function NavLink({ href, exact = false, onClick, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const hrefString = typeof href === 'string' ? href : href.pathname || '';

  // isSameUrl: only block navigation if we're on the EXACT same page
  const isSameUrl = pathname === hrefString;
  
  // isActive: for styling purposes (exact match or starts with for sub-routes)
  const isActive = exact
    ? pathname === hrefString
    : pathname === hrefString || pathname.startsWith(hrefString + '/');

  return (
    <Link
      href={href}
      onClick={(e) => {
        // Only prevent navigation if we're on the EXACT same URL
        // Don't block parent route navigation (e.g., from /app/tickets to /app)
        if (isSameUrl) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      data-active={isActive || undefined}
      {...props}
    />
  );
}
