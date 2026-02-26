'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { useCustomerPortal } from '@/components/customer/CustomerPortalContext';

export default function KBModalPage() {
  const params = useParams();
  const { openSlideOver } = useCustomerPortal();
  const slug = params?.slug as string;

  useEffect(() => {
    if (slug) {
      openSlideOver('kb', { articleSlug: slug });
    }
  }, [slug, openSlideOver]);

  return null;
}
