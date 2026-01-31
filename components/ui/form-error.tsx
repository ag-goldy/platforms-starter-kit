'use client';

import { AlertCircle } from 'lucide-react';

interface FormErrorProps {
  error?: string | null;
  className?: string;
}

export function FormError({ error, className = '' }: FormErrorProps) {
  if (!error) return null;

  return (
    <div
      className={`flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 ${className}`}
    >
      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <span>{error}</span>
    </div>
  );
}

