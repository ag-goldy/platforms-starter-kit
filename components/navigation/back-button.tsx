'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  href?: string;
  label?: string;
  className?: string;
}

/**
 * Back button that either:
 * 1. Navigates to a specific href if provided
 * 2. Goes back in history if no href provided
 */
export function BackButton({ href, label = 'Back', className }: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={className}
    >
      <ArrowLeft className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
}

/**
 * Page header with back button
 */
interface PageHeaderWithBackProps {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  children?: React.ReactNode;
}

export function PageHeaderWithBack({
  title,
  description,
  backHref,
  backLabel,
  children,
}: PageHeaderWithBackProps) {
  return (
    <div className="space-y-4">
      <BackButton href={backHref} label={backLabel || 'Back'} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && (
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
