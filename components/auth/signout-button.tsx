'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface SignOutButtonProps {
  variant?: 'ghost' | 'outline' | 'default';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function SignOutButton({ variant = 'ghost', size = 'sm', className }: SignOutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/signout', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/login';
      } else {
        // Force redirect even if API fails
        window.location.href = '/login';
      }
    } catch {
      // Force redirect on error
      window.location.href = '/login';
    }
  };

  return (
    <Button 
      variant={variant} 
      size={size}
      onClick={handleSignOut}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Signing out...
        </>
      ) : (
        'Sign out'
      )}
    </Button>
  );
}
