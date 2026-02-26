'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { rootDomain, protocol } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function NotFound() {
  const [subdomain, setSubdomain] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Extract subdomain from URL if we're on a subdomain page
    if (pathname?.startsWith('/s/')) {
      const extractedSubdomain = pathname.split('/')[2];
      if (extractedSubdomain) {
        setSubdomain(extractedSubdomain);
      }
    } else {
      // Try to extract from hostname for direct subdomain access
      const hostname = window.location.hostname;
      const rootDomainFormatted = rootDomain.split(':')[0];
      if (hostname.includes(`.${rootDomainFormatted}`)) {
        const extractedSubdomain = hostname.split('.')[0];
        setSubdomain(extractedSubdomain);
      }
    }
  }, [pathname]);

  // If we detected a subdomain, redirect to login
  if (subdomain) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-4xl font-bold">
              <span className="text-blue-600">{subdomain}</span>
            </CardTitle>
            <CardDescription className="text-lg">
              Portal Access Required
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Please sign in to access this organization portal.
            </p>
            <Link href={`/login?callbackUrl=/s/${subdomain}`}>
              <Button className="w-full">
                Sign In to Continue
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // General 404 page
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-6xl font-bold text-gray-900">404</CardTitle>
          <CardDescription className="text-xl">
            Page not found
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <div className="flex gap-3">
            <Link href="/" className="flex-1">
              <Button className="w-full">Go home</Button>
            </Link>
            <Link href="/login" className="flex-1">
              <Button variant="outline" className="w-full">Sign in</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
