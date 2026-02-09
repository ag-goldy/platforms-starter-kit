'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            We apologize for the inconvenience. An unexpected error has occurred.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <div className="rounded-md bg-gray-100 p-3">
              <p className="text-xs font-mono text-gray-600 break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs text-gray-400 mt-1">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={reset} variant="default" className="flex-1">
              Try again
            </Button>
            <Link href="/" className="flex-1">
              <Button variant="outline" className="w-full">
                Go home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
