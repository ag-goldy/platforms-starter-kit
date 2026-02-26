'use client';

import { useEffect } from 'react';
import { useCustomerPortal } from '@/components/customer/CustomerPortalContext';

export default function TeamModalPage() {
  const { openSlideOver } = useCustomerPortal();

  useEffect(() => {
    openSlideOver('team');
  }, [openSlideOver]);

  return null;
}
