'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function Loading() {
  const [showLoading, setShowLoading] = useState(true);

  useEffect(() => {
    // Safety timeout: hide loading after 5 seconds to prevent infinite loading
    const timeout = setTimeout(() => setShowLoading(false), 5000);
    return () => clearTimeout(timeout);
  }, []);

  if (!showLoading) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-sm text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
