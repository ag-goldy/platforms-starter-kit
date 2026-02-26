'use client';

import { Loader2 } from 'lucide-react';

interface PageLoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export function PageLoading({ message = 'Loading...', fullScreen = false }: PageLoadingProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
      <p className="text-gray-600 font-medium">{message}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-[400px] flex items-center justify-center">
      {content}
    </div>
  );
}
