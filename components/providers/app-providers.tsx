'use client';

import { ToastProvider } from '@/components/ui/toast';
import { GlobalCommandPalette } from '@/components/ui/command-palette';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ToastProvider>
      <GlobalCommandPalette>
        {children}
      </GlobalCommandPalette>
    </ToastProvider>
  );
}
