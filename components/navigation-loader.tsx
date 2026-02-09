'use client';

import { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function NavigationLoader() {
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Reset loading state when route changes complete
    setIsLoading(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    // Handle link clicks
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      
      if (anchor && 
          anchor.href && 
          !anchor.href.startsWith('#') &&
          !anchor.href.startsWith('javascript:') &&
          !anchor.hasAttribute('download') &&
          anchor.target !== '_blank' &&
          !e.ctrlKey && 
          !e.metaKey &&
          !e.shiftKey) {
        const url = new URL(anchor.href);
        // Only show loader for internal navigation
        if (url.origin === window.location.origin) {
          setIsLoading(true);
        }
      }
    };

    // Handle form submissions
    const handleSubmit = () => {
      setIsLoading(true);
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('submit', handleSubmit);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('submit', handleSubmit);
    };
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 backdrop-blur-[2px] transition-opacity duration-200">
      <div className="bg-white rounded-xl shadow-2xl p-6 flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-200">
        <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
        <p className="text-sm font-medium text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
