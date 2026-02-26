'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { useCustomerPortal } from '@/components/customer/CustomerPortalContext';

export default function TicketModalPage() {
  const params = useParams();
  const { openSlideOver } = useCustomerPortal();
  const ticketId = params?.id as string;

  useEffect(() => {
    if (ticketId) {
      openSlideOver('ticket', { ticketId });
    }
  }, [ticketId, openSlideOver]);

  return null;
}
