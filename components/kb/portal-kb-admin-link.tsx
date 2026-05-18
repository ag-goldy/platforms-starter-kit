'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function PortalKBAdminLink(props: { orgId: string; subdomain: string }) {
  const { orgId, subdomain } = props;
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/user/membership/${orgId}`);
        if (!res.ok) return;
        const data = await res.json();
        setRole(data.role || null);
      } catch {
        setRole(null);
      }
    }
    load();
  }, [orgId]);

  if (role !== 'CUSTOMER_ADMIN') return null;

  return (
    <Link href={`/s/${subdomain}/kb/admin`}>
      <Button variant="outline">Admin</Button>
    </Link>
  );
}

