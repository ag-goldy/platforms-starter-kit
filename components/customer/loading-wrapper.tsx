'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface LoadingWrapperProps {
  children: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  minHeight?: string;
}

export function LoadingWrapper({ 
  children, 
  isLoading, 
  error, 
  onRetry,
  minHeight = '400px'
}: LoadingWrapperProps) {
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-red-900 text-lg mb-1">Something went wrong</h3>
              <p className="text-red-700 text-sm max-w-md">{error}</p>
            </div>
            {onRetry && (
              <Button 
                onClick={onRetry}
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div style={{ minHeight }} className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
          <p className="text-gray-500 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
